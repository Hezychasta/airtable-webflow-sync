import "dotenv/config";
import Airtable from "airtable";
import axios from "axios";

// Load environment variables
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const airtableBaseId = process.env.AIRTABLE_BASE_ID;
const airtableTableName = process.env.AIRTABLE_TABLE_NAME;
const webflowApiToken = process.env.WEBFLOW_API_TOKEN;
const webflowCollectionId = process.env.WEBFLOW_COLLECTION_ID;

// Airtable API
Airtable.configure({
  apiKey: airtableApiKey,
});

// Webflow API
const WEBFLOW_API_URL = `https://api.webflow.com/v2/collections/${webflowCollectionId}/items`;
const WEBFLOW_HEADERS = {
  Authorization: `Bearer ${webflowApiToken}`,
  "Content-Type": "application/json",
  "accept-version": "1.0.0",
};
const base = Airtable.base(airtableBaseId);

// Function to fetch records from Airtable
async function fetchAirtableRecords() {
  try {
    const records = await base(airtableTableName).select().all();
    return records.map((record) => ({
      id: record.id,
      name: record.fields.Name,
    }));
  } catch (error) {
    console.error("❌ Error fetching Airtable data:", error.message);
    return [];
  }
}

// Function to fetch records from Webflow
async function fetchWebflowRecords() {
  try {
    const response = await axios.get(`${WEBFLOW_API_URL}/live`, {
      headers: WEBFLOW_HEADERS,
    });
    return response.data.items.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
    }));
  } catch (error) {
    console.error("❌ Error fetching Webflow data:", error.message);
    return [];
  }
}

// Function to map Airtable fields to Webflow fields
function mapAirtableToWebflowFields(airtableFields) {
  return {
    name: airtableFields.name,
    slug: airtableFields.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, ""),
  };
}

// Function to create and publish a new item in Webflow
async function createWebflowItem(fields) {
  try {
    const webflowFields = mapAirtableToWebflowFields(fields);

    // Create the item in Webflow (unpublished by default)
    const response = await axios.post(
      WEBFLOW_API_URL,
      {
        fields: webflowFields,
        fieldData: webflowFields,
        isArchived: false,
        isDraft: false,
      },
      { headers: WEBFLOW_HEADERS }
    );

    const itemId = response.data.id; // Get the new item ID
    console.log(`✅ Created new item in Webflow with ID: ${itemId}`);

    // Immediately publish the new item
    await publishWebflowItem(itemId);
  } catch (error) {
    console.error(
      "❌ Error creating item in Webflow:",
      error.response?.data || error.message
    );
  }
}

// Function to publish an item in Webflow
async function publishWebflowItem(itemId) {
  try {
    await axios.post(
      `${WEBFLOW_API_URL}/publish`,
      { itemIds: [itemId] }, // Send item ID in an array
      { headers: WEBFLOW_HEADERS }
    );

    console.log(`✅ Published item in Webflow with ID: ${itemId}`);
  } catch (error) {
    console.error(
      "❌ Error publishing item in Webflow:",
      error.response?.data || error.message
    );
  }
}

// Function to update an existing item in Webflow
async function updateWebflowItem(itemId, fields) {
  try {
    const webflowFields = mapAirtableToWebflowFields(fields);
    delete webflowFields.slug; // Ignore the slug field when updating
    console.log(
      `Updating Webflow item ID: ${itemId} with fields:`,
      webflowFields
    );
    const response = await axios.patch(
      `${WEBFLOW_API_URL}/${itemId}`,
      {
        fields: webflowFields,
        fieldData: webflowFields,
      },
      {
        headers: WEBFLOW_HEADERS,
      }
    );
    console.log(`✅ Updated item in Webflow with ID: ${response.data._id}`);
  } catch (error) {
    console.error(
      "❌ Error updating item in Webflow:",
      error.response?.data || error.message
    );
  }
}

// Function to delete an item from Webflow
async function deleteWebflowItem(itemId) {
  try {
    console.log(`Deleting Webflow item with ID: ${itemId}`);

    // Delete the item directly
    await axios.delete(`${WEBFLOW_API_URL}/${itemId}`, {
      headers: WEBFLOW_HEADERS,
    });

    console.log(`✅ Deleted item in Webflow with ID: ${itemId}`);
  } catch (error) {
    console.error(
      "❌ Error deleting item in Webflow:",
      error.response?.data || error.message
    );
  }
}

// Function to sync Airtable records to Webflow
async function syncAirtableToWebflow() {
  const airtableRecords = await fetchAirtableRecords();
  const webflowRecords = await fetchWebflowRecords();

  const airtableSlugs = new Set(
    airtableRecords.map((record) =>
      record.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/g, "")
    )
  );

  // Update or create records in Webflow
  for (const record of airtableRecords) {
    console.log("Processing Airtable record:", record);
    const slug = record.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "");
    const existingItem = webflowRecords.find((item) => item.slug === slug);
    if (existingItem) {
      await updateWebflowItem(existingItem.id, record);
    } else {
      await createWebflowItem(record);
    }
  }

  // Delete records from Webflow that are not in Airtable
  for (const item of webflowRecords) {
    if (!airtableSlugs.has(item.slug)) {
      await deleteWebflowItem(item.id);
    }
  }
}

// Run the sync
syncAirtableToWebflow();
