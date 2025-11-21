import app from "./app.js";
import loadCircuits from "./data/loadCircuits.js";

const PORT = process.env.PORT || 3002;

let circuitsData = [];

loadCircuits().then(data => {
    circuitsData = data;
    console.log("Circuits chargés :", circuitsData.length);

    app.locals.circuitsData = circuitsData;

    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}/`)
    );
});

