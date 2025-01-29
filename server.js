require("dotenv").config();
const Airtable = require("airtable");
const axios = require("axios");

// Load environment variables
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const airtableBaseId = process.env.AIRTABLE_BASE_ID;
const airtableTableName = process.env.AIRTABLE_TABLE_NAME;
const webflowApiKey = process.env.WEBFLOW_API_KEY;
const webflowCollectionId = process.env.WEBFLOW_COLLECTION_ID;
const webflowItemId = "679a40ad1665562b68b09afa"; // The specific item ID to update

Airtable.configure({
  apiKey: airtableApiKey,
});

const base = Airtable.base(airtableBaseId);

async function updateWebflowItem() {
  try {
    const records = await base(airtableTableName)
      .select({ maxRecords: 1 })
      .firstPage();

    if (records.length === 0) {
      console.log("No records found in Airtable.");
      return;
    }

    const record = records[0];
    const miasto = record.get("Miasto");

    // Log the record to debug
    console.log(`Processing record: ${record.id}`, record.fields);

    // Ensure the required fields are not empty
    if (!miasto) {
      console.warn(
        `Skipping record ${record.id} due to missing 'Miasto' field`
      );
      return;
    }

    const data = {
      isArchived: false,
      isDraft: false,
      fieldData: {
        miasto: miasto,
      },
    };

    console.log(`Data to be sent to Webflow:`, JSON.stringify(data, null, 2));

    try {
      const response = await axios.patch(
        `https://api.webflow.com/v2/collections/${webflowCollectionId}/items/${webflowItemId}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${webflowApiKey}`,
            "Content-Type": "application/json",
            "accept-version": "1.0.0",
          },
        }
      );

      console.log(`Record ${record.id} updated in Webflow`, response.data);
    } catch (postError) {
      console.error(
        `Error updating record ${record.id}:`,
        postError.response ? postError.response.data : postError.message,
        postError.response ? postError.response : postError
      );
    }
  } catch (error) {
    console.error(
      "Error fetching data from Airtable:",
      error.response ? error.response.data : error.message
    );
  }
}

updateWebflowItem();
