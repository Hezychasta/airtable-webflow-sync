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
Airtable.configure({ apiKey: airtableApiKey });
const base = Airtable.base(airtableBaseId);

// Webflow API
const WEBFLOW_API_URL = `https://api.webflow.com/v2/collections/${webflowCollectionId}/items`;
const WEBFLOW_HEADERS = {
  Authorization: `Bearer ${webflowApiToken}`,
  "Content-Type": "application/json",
  "accept-version": "1.0.0",
};

// Function to fetch records from Airtable
async function fetchAirtableRecords() {
  try {
    const records = await base(airtableTableName).select().all();
    return records.map((record) => ({
      name: record.fields.Name,
      city: record.fields.City,
      slug: record.fields.Name.toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/g, ""),
    }));
  } catch (error) {
    console.error("❌ Error fetching Airtable data:", error.message);
  }
}

// Function to fetch records from Webflow
async function fetchWebflowRecords() {
  try {
    const response = await axios.get(`${WEBFLOW_API_URL}/live`, {
      headers: WEBFLOW_HEADERS,
    });
    return response.data.items.map((item) => ({
      id: item._id,
      name: item.name || "",
      city: item.city || "",
      slug: item.slug || "",
    }));
  } catch (error) {
    console.error("❌ Error fetching Webflow data:", error.message);
  }
}

// Function to update an existing item in Webflow
async function updateWebflowItem(itemId, fields) {
  try {
    delete fields.slug; // Ignore the slug field when updating
    console.log(`Updating Webflow item ID: ${itemId} with fields:`, fields);
    const response = await axios.patch(
      `${WEBFLOW_API_URL}/${itemId}`,
      { fields, fieldData: fields },
      { headers: WEBFLOW_HEADERS }
    );
    console.log(`✅ Updated item in Webflow with ID: ${response.data._id}`);
  } catch (error) {
    console.error(
      "❌ Error updating item in Webflow:",
      error.response?.data || error.message
    );
  }
}

// Function to create a new item in Webflow
async function createWebflowItem(fields) {
  try {
    const response = await axios.post(
      WEBFLOW_API_URL,
      { fields, fieldData: fields, isArchived: false, isDraft: false },
      { headers: WEBFLOW_HEADERS }
    );
    console.log(`✅ Created new item in Webflow with ID: ${response.data._id}`);
  } catch (error) {
    console.error(
      "❌ Error creating item in Webflow:",
      error.response?.data || error.message
    );
  }
}

// Function to delete an item from Webflow
async function deleteWebflowItem(itemId) {
  try {
    console.log(`Deleting Webflow item with ID: ${itemId}`);
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

  const airtableSlugs = new Set(airtableRecords.map((record) => record.slug));

  // Step 1: Update existing items or create new ones
  for (const record of airtableRecords) {
    console.log("Processing Airtable record:", record);
    const existingItem = webflowRecords.find(
      (item) => item.slug === record.slug
    );
    if (existingItem) {
      await updateWebflowItem(existingItem.id, record);
    } else {
      await createWebflowItem(record);
    }
  }

  // Step 2: Delete records from Webflow that are not in Airtable
  for (const item of webflowRecords) {
    if (!airtableSlugs.has(item.slug)) {
      await deleteWebflowItem(item.id);
    }
  }
}

// Run the sync
syncAirtableToWebflow();
