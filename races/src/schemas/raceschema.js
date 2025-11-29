import mongoose from "mongoose";

const raceSchema = new mongoose.Schema({
  circuitId: {
    type: Number,
    required: true
  },

  season: {
    type: Number,
    required: true
  },

  competitors: [
    {
      driverId: {
        type: Number,
        required: true
      },
      constructorId: {
        type: Number,
        required: true
      },
      position: {
        type: Number
      },
      status: {
        type: String,
        enum: ['Finished', 'DidNotFinished', 'Disqualified'],
        required: true
      },
    },
  ],
});

export default mongoose.model("Race", raceSchema);
