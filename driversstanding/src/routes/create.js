import express from "express";
import DriversStanding from "../schemas/driversstandingschema.js";

const router = express.Router();

router.post("/", async(req, res) => {
    //On reçoit le résultat de la course
    const raceResult = req.body;
    //On regarde la saison de la course
    const raceSeason = raceResult.season;
    console.log("DriversStanding:", DriversStanding);
    console.log("find:", DriversStanding.find);
    console.log("default:", DriversStanding.default);
    //Récupérer classement grâce à la saison
    const driversstanding = await DriversStanding.findOne({ season: raceSeason });
    //Si il existe
    if (driversstanding) {
      //Calcul des points
      const pointsByPosition = {
        1: 25,
        2: 18,
        3: 15,
        4: 12,
        5: 10,
        6: 8,
        7: 6,
        8: 4,
        9: 2,
        10: 1,
      };

      raceResult.competitors.forEach((competitor) => {
        if (competitor.position <= 10) {
          const currentDriver = driversstanding.competitors.find(
            (c) => c.driverId === competitor.driverId
          );

          currentDriver.points += pointsByPosition[competitor.position];

          if (competitor.position === 1) {
            currentDriver.winNumber += 1;
          }
        }
      });

      //Modifier le classement
      driversstanding.competitors.sort((a, b) => b.points - a.points);

      driversstanding.competitors.forEach((competitor, index) => {
        competitor.position = index + 1;
      });

      await driversstanding.save();

      return res.status(201).json(driversstanding);
    } else {
      //Création du classement
      const newCompetitors = [];
      raceResult.competitors.forEach((competitor) => {
        newCompetitors.push({
          driverId: competitor.driverId,
          position: 1,
          points: 0,
          winNumber: 0,
        });
      });

      const newStanding = new DriversStanding({
        season: raceSeason,
        competitors: newCompetitors,
      });

      //Calcul des points
      const pointsByPosition = {
        1: 25,
        2: 18,
        3: 15,
        4: 12,
        5: 10,
        6: 8,
        7: 6,
        8: 4,
        9: 2,
        10: 1,
      };

      raceResult.competitors.forEach((competitor) => {
        if (competitor.position <= 10) {
          const currentDriver = newStanding.competitors.find(
            (c) => c.driverId === competitor.driverId
          );

          currentDriver.points += pointsByPosition[competitor.position];

          if (competitor.position === 1) {
            currentDriver.winNumber += 1;
          }
        }
      });

      //Calcul des positions
      newStanding.competitors.sort((a, b) => b.points - a.points);

      newStanding.competitors.forEach((competitor, index) => {
        competitor.position = index + 1;
      })

      //Création du classement
      const createdDriversStanding = await DriversStanding.create(newStanding);
      return res.status(201).json(createdDriversStanding);
    }
});

export default router;
