const clamp = (value, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

function rangeScore(value, idealMinimum, idealMaximum, hardMinimum, hardMaximum) {
  if (value >= idealMinimum && value <= idealMaximum) return 100;
  if (value <= hardMinimum || value >= hardMaximum) return 0;
  if (value < idealMinimum) return 100 * (value - hardMinimum) / (idealMinimum - hardMinimum);
  return 100 * (hardMaximum - value) / (hardMaximum - idealMaximum);
}

export function calculateMetrics(reading) {
  const { soilMoisture, temperature, humidity, battery = 100 } = reading.sensors;
  const soilScore = rangeScore(soilMoisture, 38, 68, 5, 92);
  const temperatureScore = rangeScore(temperature, 18, 32, 5, 48);
  const humidityScore = rangeScore(humidity, 40, 80, 10, 100);
  const batteryScore = clamp(battery);
  const cropHealth = Math.round(soilScore * 0.45 + temperatureScore * 0.25 + humidityScore * 0.2 + batteryScore * 0.1);

  let irrigation = { action: "hold", urgency: "none", reason: "Soil moisture is within the target band." };
  if (soilMoisture < 15) {
    irrigation = { action: "irrigate", urgency: "critical", reason: "Soil moisture is below 15%." };
  } else if (soilMoisture < 30) {
    irrigation = { action: "irrigate", urgency: "soon", reason: "Soil moisture is below the 30% irrigation threshold." };
  } else if (soilMoisture > 85) {
    irrigation = { action: "stop", urgency: "warning", reason: "Soil may be waterlogged." };
  }

  const alerts = [];
  if (temperature > 40) alerts.push({ type: "heat", severity: "high", message: "Temperature exceeds 40°C." });
  if (temperature < 8) alerts.push({ type: "cold", severity: "high", message: "Temperature is below 8°C." });
  if (soilMoisture < 15) alerts.push({ type: "dry-soil", severity: "critical", message: "Critical soil moisture level." });
  if (soilMoisture > 85) alerts.push({ type: "waterlogging", severity: "medium", message: "Possible waterlogging." });
  if (battery < 20) alerts.push({ type: "battery", severity: "medium", message: "Sensor battery is low." });

  return {
    cropHealth,
    componentScores: {
      soil: Math.round(soilScore),
      temperature: Math.round(temperatureScore),
      humidity: Math.round(humidityScore),
      battery: Math.round(batteryScore)
    },
    irrigation,
    alerts
  };
}

export function trend(readings, field) {
  if (readings.length < 2) return 0;
  const first = Number(readings[0].sensors[field]);
  const last = Number(readings.at(-1).sensors[field]);
  return Math.round((last - first) * 100) / 100;
}

