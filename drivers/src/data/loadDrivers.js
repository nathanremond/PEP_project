import fs from "fs";
import csv from "csv-parser";

export default function loadDrivers() {
    return new Promise((resolve, reject) => {
        const results = [];

        fs.createReadStream("./src/data/drivers.csv")
            .pipe(csv())
            .on("data", (data) => results.push(data))
            .on("end", () => resolve(results))
            .on("error", reject);
    });
}
