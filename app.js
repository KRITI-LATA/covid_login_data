const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
module.exports = app;
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializerDatabaseServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializerDatabaseServer();

const convertDatabaseObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

// Login query

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const loginUserQuery = `select * from user where 
    username = '${username}'`;
  const dbUser = await db.get(loginUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "sdgfryyjvhn");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authentication"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Tokens");
  } else {
    jwt.verify(jwtToken, "sdgfryyjvhn", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//Returns a list of all states in the state table

app.get("/states/", authenticationToken, async (request, response) => {
  console.log("get book api");
  const covidStateQuery = `select * from state`;
  const dbResponse = await db.all(covidStateQuery);
  response.send(
    dbResponse.map((eachArray) =>
      convertDatabaseObjectToResponseObject(eachArray)
    )
  );
});

//Returns a state based on the state ID

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const stateDetailQuery = `select * from state where state_id = '${stateId}'`;
  const dbResponse = await db.get(stateDetailQuery);
  response.send(convertDatabaseObjectToResponseObject(dbResponse));
});

//Create a district in the district table, district_id is auto-incremented

app.post("/districts/", async (request, response) => {
  const districtDetail = request.body;
  const { districtName, cases, cured, active, deaths } = districtDetail;
  const districtDetailQuery = `insert into district 
    (district_name, cases, cured, active, deaths) values 
    ('${districtName}', ${cases}, ${cured}, ${active}, ${deaths})`;
  const dbResponse = await db.run(districtDetailQuery);
  const districtId = dbResponse.lastId;
  response.send("District Successfully Added");
});

//Returns a district based on the district ID

app.get("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const districtParticularDetailQuery = `select * from district where 
    district_id = ${districtId}`;
  const particularDistrict = await db.get(districtParticularDetailQuery);
  response.send(convertDatabaseObjectToResponseObject(particularDistrict));
});

//Deletes a district from the district table based on the district ID

app.delete("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const deleteDistrictQuery = `delete from district where district_id = ${districtId}`;
  await db.run(deleteDistrictQuery);
  response.send("District Removed");
});

//Updates the details of a specific district based on the district ID

app.put("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const updateDistrict = request.body;
  const { districtName, cases, cured, active, deaths } = updateDistrict;
  const updateDistrictQuery = `update district set 
    district_name = '${districtName}',
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths} where district_id = ${districtId}`;
  await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

//Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID
app.get("/states/:stateId/stats/", async (request, response) => {
  const { stateId } = request.params;
  const getStatesStatsQuery = `select sum(cases),
    sum(cured), 
    sum(active), 
    sum(deaths) from district where state_id = ${stateId}`;
  const stats = await db.get(getStatesStatsQuery);
  response.send({
    totalCases: stats["sum(cases)"],
    totalCured: stats["sum(cured)"],
    totalActive: stats["sum(active)"],
    totalDeaths: stats["sum(deaths)"],
  });
});
