
const express = require('express');
const cors = require('cors');


const NdviRouter =require("./routers/ndviRouter")






const app = express();
app.use(cors());
app.use(express.json());


app.use('/api', NdviRouter);

const PORT = 5002;
app.listen(PORT, async () => {

  console.log(`🚀 Server running on port ${PORT}`);
});



