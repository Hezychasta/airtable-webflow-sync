import dotenv from "dotenv";
import axios from "axios";
import { writeFile } from "fs/promises"; // Używamy fs/promises dla async/await

dotenv.config(); // Ładuje zmienne z .env

const apiToken = process.env.WEBFLOW_API_TOKEN;
const collectionId = process.env.WEBFLOW_COLLECTION_ID;

async function getCMSData() {
  try {
    const response = await axios.get(
      `https://api.webflow.com/v2/collections/${collectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          accept: "application/json",
        },
      }
    );
    const jsonData = JSON.stringify(response.data, null, 2); // Ładnie sformatowany JSON
    await writeFile("webflow_data.json", jsonData, "utf8"); // Zapis do pliku
    console.log("Dane zapisano do pliku: webflow_data.json");
  } catch (error) {
    console.error(
      "Błąd:",
      error.response ? error.response.data : error.message
    );
  }
}

getCMSData();
