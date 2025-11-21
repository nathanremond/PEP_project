import fs from "fs";
import csv from "csv-parser";

export default function loadConstructors() {
    return new Promise((resolve, reject) => {
        const results = [];

        fs.createReadStream("./src/data/constructors.csv")
            .pipe(csv())
            .on("data", (data) => results.push(data))
            .on("end", () => resolve(results))
            .on("error", reject);
    });
}
