

import axios from "axios";

const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;

/**
 * Get ETA and distance between two coordinates using LocationIQ Directions API
 * @param driverCoords [lng, lat]
 * @param pickupCoords { lat: number, lng: number }
 */
export async function getETAFromLocationIQ(
  driverCoords: [number, number],
  pickupCoords: { lat: number; lng: number }
): Promise<{ distance: number; duration: number } | null> {
  try {
    const url = `https://us1.locationiq.com/v1/directions/driving/${driverCoords[0]},${driverCoords[1]};${pickupCoords.lng},${pickupCoords.lat}?key=${LOCATIONIQ_API_KEY}&overview=false`;

    const response = await axios.get(url);

    if (
      response.data &&
      response.data.routes &&
      response.data.routes.length > 0
    ) {
      const route = response.data.routes[0];
      return {
        distance: route.distance, // meters
        duration: route.duration, // seconds
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching ETA from LocationIQ:", error);
    return null;
  }
}
