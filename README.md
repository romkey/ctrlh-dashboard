# CTRLH Dashboard

This is a prototype dashboard for [PDX Hackerspace](https://pdxhackerspace.org).

It's based on data  fed to it by an MQTT broker that uses adapters to publish  data from a variety of sources (hardware sensors, OpenWeatherMap, SNMP).

Data is published with the "retain" flag set, so when the page loads it can always show the most recent data.

Most publishers  update once a minute, so there may be up to a minute lag.

Currently it cannot be served over HTTPS because our MQTT websocket server crashes when it uses SSL and HTTPS pages require SSL websockets.

## Contributing

I welcome contributions! Fork it and submit a PR, or open an issue or contact me to contribute.

## License

This code is published under the [MIT License](https://romkey.mit-license.org).
