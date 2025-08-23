
import dotenv from "dotenv";
dotenv.config();

async function getCoordinatesFromAddress(address: string) {
  const apiKey = process.env.LOCATIONIQ_API_KEY; 
  const url = `https://us1.locationiq.com/v1/search?key=${apiKey}&q=${encodeURIComponent(
    address
  )}&format=json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Error fetching coordinates:", response.statusText);
      return null;
    }

    const data: any = await response.json();
    if (!data.length) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch (err) {
    console.error("Error:", err);
    return null;
  }
}

export default getCoordinatesFromAddress;
