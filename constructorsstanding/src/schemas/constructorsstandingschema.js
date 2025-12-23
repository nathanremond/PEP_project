import mongoose from "mongoose";

const constructorsStandingSchema = new mongoose.Schema({
  season: {
    type: Number,
    required: true,
  },

  competitors: [
    {
      constructorId: {
        type: Number,
        required: true,
      },

      position: {
        type: Number,
        required: true,
      },

      points: {
        type: Number,
        required: true,
      },

      winNumber: {
        type: Number,
        required: true,
      },
    },
  ],
});

export default mongoose.model("ConstructorsStanding", constructorsStandingSchema);
