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
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`;
const AIRTABLE_HEADERS = {
  Authorization: `Bearer ${airtableApiKey}`,
  "Content-Type": "application/json",
};
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
      name: record.fields.Name,
    }));
  } catch (error) {
    console.error("❌ Error fetching Airtable data:", error.message);
  }
}

// Function to map Airtable fields to Webflow fields
function mapAirtableToWebflowFields(airtableFields) {
  return {
    name: airtableFields.name,
    slug: airtableFields.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, ""), // Generate slug from name and ensure it matches the required pattern
    // Add other field mappings as needed
  };
}

// Function to create a new item in Webflow
async function createWebflowItem(fields) {
  try {
    const webflowFields = mapAirtableToWebflowFields(fields);
    const response = await axios.post(
      WEBFLOW_API_URL,
      {
        fields: webflowFields,
        fieldData: webflowFields,
        isArchived: false,
        isDraft: false,
      },
      {
        headers: WEBFLOW_HEADERS,
      }
    );
    console.log(`✅ Created new item in Webflow with ID: ${response.data._id}`);
  } catch (error) {
    console.error(
      "❌ Error creating item in Webflow:",
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

// Function to sync Airtable records to Webflow
async function syncAirtableToWebflow() {
  const airtableRecords = await fetchAirtableRecords();
  for (const record of airtableRecords) {
    console.log("Processing Airtable record:", record);
    // Check if the item already exists in Webflow
    const existingItem = await getWebflowItemBySlug(
      record.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/g, "")
    );
    if (existingItem) {
      await updateWebflowItem(existingItem._id, record);
    } else {
      await createWebflowItem(record);
    }
  }
}

// Function to get a Webflow item by slug
async function getWebflowItemBySlug(slug) {
  try {
    const response = await axios.get(`${WEBFLOW_API_URL}/live`, {
      headers: WEBFLOW_HEADERS,
    });
    return response.data.items.find((item) => item.slug === slug);
  } catch (error) {
    console.error("❌ Error fetching Webflow items:", error.message);
  }
}

// Run the sync
syncAirtableToWebflow();
