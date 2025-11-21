import app from "./app.js";
import loadConstructors from "./data/loadConstructors.js";

const PORT = process.env.PORT || 3001;

let constructorsData = [];

loadConstructors().then(data => {
    constructorsData = data;
    console.log("Constructors chargés :", constructorsData.length);

    app.locals.constructorsData = constructorsData;

    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}/`)
    );
});