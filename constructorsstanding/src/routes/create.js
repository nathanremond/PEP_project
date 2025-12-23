import express from "express";
import ConstructorsStanding from "../schemas/constructorsstandingschema.js";

const router = express.Router();

router.post("/", async(req, res) => {
    //On reçoit le résultat de la course
    const raceResult = req.body;
    //On regarde la saison de la course
    const raceSeason = raceResult.season;
    //Récupérer classement grâce à la saison
    const constructorsstanding = await ConstructorsStanding.findOne({ season: raceSeason });
    //Si il existe
    if (constructorsstanding) {
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
          const currentConstructor = constructorsstanding.competitors.find(
            (c) => c.constructorId === competitor.constructorId
          );

          currentConstructor.points += pointsByPosition[competitor.position];

          if (competitor.position === 1) {
            currentConstructor.winNumber += 1;
          }
        }
      });

      //Modifier le classement
      constructorsstanding.competitors.sort((a, b) => b.points - a.points);

      constructorsstanding.competitors.forEach((competitor, index) => {
        competitor.position = index + 1;
      });

      await constructorsstanding.save();

      return res.status(201).json(constructorsstanding);
    } else {
      //Création du classement
      const newCompetitors = [];
      raceResult.competitors.forEach((competitor) => {
        const existConstructor = newCompetitors.find(
          (c) => c.constructorId === competitor.constructorId
        );

        if (!existConstructor){
          newCompetitors.push({
            constructorId: competitor.constructorId,
            position: 1,
            points: 0,
            winNumber: 0
          });
        };
      });

      const newStanding = new ConstructorsStanding({
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
          const currentConstructor = newStanding.competitors.find(
            (c) => c.constructorId === competitor.constructorId
          );

          currentConstructor.points += pointsByPosition[competitor.position];

          if (competitor.position === 1) {
            currentConstructor.winNumber += 1;
          }
        }
      });

      //Calcul des positions
      newStanding.competitors.sort((a, b) => b.points - a.points);

      newStanding.competitors.forEach((competitor, index) => {
        competitor.position = index + 1;
      });

      //Création du classement
      const createdConstructorsStanding = await ConstructorsStanding.create(newStanding);
      return res.status(201).json(createdConstructorsStanding);
    }
});

export default router;
