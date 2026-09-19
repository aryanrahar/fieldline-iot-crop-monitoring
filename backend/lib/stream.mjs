export class StreamHub {
  constructor() {
    this.clients = new Set();
  }

  subscribe(response, deviceId = "") {
    const client = { response, deviceId };
    this.clients.add(client);
    return () => this.clients.delete(client);
  }

  publish(event, payload) {
    const serialized = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) {
      if (client.deviceId && payload.reading?.deviceId !== client.deviceId) continue;
      client.response.write(serialized);
    }
  }

  heartbeat() {
    for (const client of this.clients) client.response.write(`: heartbeat ${Date.now()}\n\n`);
  }

  get size() {
    return this.clients.size;
  }
}
