import "dotenv/config";
import Airtable from "airtable";
import axios from "axios";

// Configure Airtable
const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID);

// Webflow API configuration
const webflowApi = axios.create({
  baseURL: "https://api.webflow.com/v2/collections/",
  headers: {
    Authorization: `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
    "accept-version": "1.0.0",
  },
});

// Field mapping configuration (adjust according to your fields)
const FIELD_MAPPING = {
  Name: "name",
  City: "city",
  Price: "price",
  Description: "description",
  "Building area": "building-area",
  "Plot area": "plot-area",
  Category: "category",
  "Photo URL": "photo",
  Slug: "slug",
};

const WEBFLOW_ITEM_ID_FIELD = "Webflow Item ID"; // Airtable field to store Webflow ID

async function syncWebflowWithAirtable() {
  try {
    // 1. Get Airtable records
    const airtableRecords = await getAirtableRecords();

    // 2. Get Webflow items
    const webflowItems = await getWebflowItems();

    // 3. Compare and perform sync
    await processSync(airtableRecords, webflowItems);

    console.log("Sync completed successfully");
  } catch (error) {
    console.error("Sync failed:", error.response?.data || error.message);
  }
}

async function getAirtableRecords() {
  const records = await base(process.env.AIRTABLE_TABLE_NAME).select().all();
  return records.map((record) => ({
    id: record.id,
    fields: mapAirtableToWebflowFields(record.fields),
    webflowId: record.get(WEBFLOW_ITEM_ID_FIELD),
  }));
}

function mapAirtableToWebflowFields(fields) {
  const mapped = {};
  for (const [airtableField, webflowField] of Object.entries(FIELD_MAPPING)) {
    if (fields[airtableField]) {
      mapped[webflowField] = fields[airtableField];
    }
  }
  return mapped;
}

async function getWebflowItems() {
  const response = await webflowApi.get(
    `${process.env.WEBFLOW_COLLECTION_ID}/items/live`
  );

  console.log("Webflow Response:", response.data); // Debugging

  return (
    response.data.items?.map((item) => ({
      id: item.id,
      fields: item.fieldData,
    })) || []
  );
}

async function processSync(airtableRecords, webflowItems) {
  const webflowItemsMap = new Map(webflowItems.map((item) => [item.id, item]));
  const airtableItemsMap = new Map(
    airtableRecords.map((record) => [record.webflowId, record])
  );

  // Create or update items
  for (const airtableRecord of airtableRecords) {
    if (!airtableRecord.webflowId) {
      // Create new item in Webflow
      const newItem = await createWebflowItem(airtableRecord.fields);
      await updateAirtableRecord(airtableRecord.id, {
        [WEBFLOW_ITEM_ID_FIELD]: newItem.id,
      });
    } else {
      // Update existing item if needed
      const webflowItem = webflowItemsMap.get(airtableRecord.webflowId);
      if (
        webflowItem &&
        needsUpdate(webflowItem.fields, airtableRecord.fields)
      ) {
        await updateWebflowItem(
          airtableRecord.webflowId,
          airtableRecord.fields
        );
      }
    }
  }

  // Delete items removed from Airtable
  for (const webflowItem of webflowItems) {
    if (!airtableItemsMap.has(webflowItem.id)) {
      await deleteWebflowItem(webflowItem.id);
    }
  }
}

async function createWebflowItem(fields) {
  const response = await webflowApi.post(
    `${process.env.WEBFLOW_COLLECTION_ID}/items`,
    { fieldData: fields, isArchived: false }
  );
  return response.data;
}

async function updateWebflowItem(itemId, fields) {
  await webflowApi.patch(
    `${process.env.WEBFLOW_COLLECTION_ID}/items/${itemId}`,
    { fieldData: fields }
  );
}

async function deleteWebflowItem(itemId) {
  await webflowApi.delete(
    `${process.env.WEBFLOW_COLLECTION_ID}/items/${itemId}`
  );
}

async function updateAirtableRecord(recordId, fields) {
  await base(process.env.AIRTABLE_TABLE_NAME).update(recordId, fields);
}

function needsUpdate(webflowFields, airtableFields) {
  return Object.keys(airtableFields).some(
    (key) => webflowFields[key] !== airtableFields[key]
  );
}

// Run the sync
syncWebflowWithAirtable();
