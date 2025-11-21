import app from "./app.js";
import loadDrivers from "./data/loadDrivers.js";

const PORT = process.env.PORT || 3000;

let driversData = [];

loadDrivers().then(data => {
    driversData = data;
    console.log("Drivers chargés :", driversData.length);

    app.locals.driversData = driversData;

    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}/`)
    );
});

