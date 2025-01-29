require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = 3000;

// Airtable API
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_NAME}`;
const AIRTABLE_HEADERS = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  "Content-Type": "application/json",
};

// Webflow API
const WEBFLOW_API_URL = `https://api.webflow.com/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`;
const WEBFLOW_HEADERS = {
  Authorization: `Bearer ${process.env.WEBFLOW_API_KEY}`,
  "Content-Type": "application/json",
};

// Last fetched record timestamp
let lastFetchedTime = new Date().toISOString();

// Function to check for new or updated records
async function fetchAirtableUpdates() {
  try {
    const response = await axios.get(AIRTABLE_API_URL, {
      headers: AIRTABLE_HEADERS,
    });
    const records = response.data.records;

    // Filter records updated since last fetch
    const updatedRecords = records.filter(
      (record) => new Date(record.createdTime) > new Date(lastFetchedTime)
    );

    if (updatedRecords.length > 0) {
      console.log(`🔹 Found ${updatedRecords.length} new/updated records.`);

      for (const record of updatedRecords) {
        await sendToWebflow(record);
      }

      // Update lastFetchedTime
      lastFetchedTime = new Date().toISOString();
    } else {
      console.log("✅ No new updates.");
    }
  } catch (error) {
    console.error("❌ Error fetching Airtable data:", error.message);
  }
}

// Function to send data to Webflow
async function sendToWebflow(record) {
  try {
    const response = await axios.post(
      WEBFLOW_API_URL,
      {
        fields: {
          name: record.fields.Name,
          slug: record.fields.Slug,
        },
      },
      { headers: WEBFLOW_HEADERS }
    );

    console.log(
      `✅ Successfully added record to Webflow: ${response.data._id}`
    );
  } catch (error) {
    console.error(
      "❌ Error sending data to Webflow:",
      error.response?.data || error.message
    );
  }
}

// Poll Airtable every 10 seconds
setInterval(fetchAirtableUpdates, 10000);

app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
