# CTRLH Dashboard

This is a prototype dashboard for [PDX Hackerspace](https://pdxhackerspace.org).

The dashboard pulls data from an MQTT broker using the Homebus protocol. Homebus uses MQTT defines a structured data-oriented network layer above MQTT which enforces access control based on the types of data.

The dashboard depends on Bootstrap, Bootswatch, jQuery, [Timeago](https://timeago.yarp.com/) and [ekko lightbox](https://ashleydw.github.io/lightbox/).

## Structure

Ideally the dashboard consists of a page of container elements which identify the publisher whose data they're presenting. At page load the container elements are filled with HTML based on templates embedded in the Javascript.

Container elements may use several [`data-` attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes) to provide information to the templates:
- `data-name` - a human-friendly name for the element (for instance, 'Prusa-1' or 'Garden').
- `data-gallery` - a gallery name to allow ekko-lightbox to group images
- `data-transform`- the name of a simple function to call to transform data before storing it. Transforms should do simple math or string computations but avoid anything which might block the event loop or take a long time to run.

Container elements should have an `id` set to the `UUID` of the Homebus data they are presenting. Elements with the container tagged with the `UUID` may have a class set to the DDC of the data with dots translated to dashes (for instance, `org.homebus.experimental.air-sensor` would be `org-homebus-experimental-air-sensor`) in order to avoid compatability issues and ambiguities with the `.` character inside CSS class names.

## Contributing

Contributions are welcome! Fork it and submit a PR, or open an issue or contact me to contribute.

## License

This code is published under the [MIT License](https://romkey.mit-license.org).
