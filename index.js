import "dotenv/config";
import http from "node:http";
import { send, serve } from "micro";
import qs from "node:url";
import axios from "axios";

const handler = async (req, res) => {
  const querystring = qs.parse(new URL(`http://whatever${req.url}`).search, {
    ignoreQueryPrefix: true,
  });
  if (querystring.query["api-key"] != process.env.AUTH_API_KEY) {
    return send(res, 401, { error: "auth" });
  }

  if (req.method.toLowerCase() != "get") {
    return send(res, 405, { error: "method" });
  }

  const { status, data } = await getAllData();

  send(res, status, data);
};

const server = new http.Server(serve(handler));

server.on("listening", () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});
server.on("error", (error) => {
  console.error(error);
});

server.listen(Number(process.env.PORT));

async function getAllData() {
  const arr = [];
  arr.push(await getYearlyData());
  arr.push(await getMonthlyData());
  arr.push(await getDailyData());
  arr.push(await getHourlyData());

  const finalResult = arr.reduce(sumFormatted, {
    consumption: 0,
    production: 0,
  });
  return { status: 200, data: finalResult };
}

async function getYearlyData() {
  const body = {
    query: `{
    viewer {
      homes {
        consumption(resolution: ANNUAL, last: 100, filterEmptyNodes: true) {
          nodes {
            consumption
          }
        }
        production(resolution: ANNUAL, last: 100,  filterEmptyNodes: true) {
          nodes {
            production
          }
        }
      }
    }
  }`,
  };
  return getData(body);
}

async function getMonthlyData() {
  const firstDayOfYearB64 = btoa(
    getLocalISOString(new Date(new Date().getFullYear(), 0, 1))
  );
  const body = {
    query: `{
    viewer {
      homes {
        consumption(resolution: MONTHLY, first: 12, after: "${firstDayOfYearB64}", filterEmptyNodes: true) {
          nodes {
            consumption
          }
        }
        production(resolution: MONTHLY, first: 12, after: "${firstDayOfYearB64}",  filterEmptyNodes: true) {
          nodes {
            production
          }
        }
      }
    }
  }`,
  };
  return getData(body);
}

async function getDailyData() {
  const firstDayOfMonthB64 = btoa(
    getLocalISOString(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    )
  );
  const body = {
    query: `{
    viewer {
      homes {
        consumption(resolution: DAILY, first: 31, after: "${firstDayOfMonthB64}", filterEmptyNodes: true) {
          nodes {
            consumption
          }
        }
        production(resolution: DAILY, first: 31, after: "${firstDayOfMonthB64}",  filterEmptyNodes: true) {
          nodes {
            production
          }
        }
      }
    }
  }`,
  };
  return getData(body);
}

async function getHourlyData() {
  const firstHourOfDayB64 = btoa(
    getLocalISOString(
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate()
      )
    )
  );
  const body = {
    query: `{
    viewer {
      homes {
        consumption(resolution: HOURLY, first: 24, after: "${firstHourOfDayB64}", filterEmptyNodes: true) {
          nodes {
            consumption
          }
        }
        production(resolution: HOURLY, first: 24, after: "${firstHourOfDayB64}",  filterEmptyNodes: true) {
          nodes {
            production
          }
        }
      }
    }
  }`,
  };
  return getData(body);
}

function getLocalISOString(date) {
  const offset = date.getTimezoneOffset();
  const offsetAbs = Math.abs(offset);
  const isoString = new Date(date.getTime() - offset * 60 * 1000).toISOString();
  return `${isoString.slice(0, -1)}${offset > 0 ? "-" : "+"}${String(
    Math.floor(offsetAbs / 60)
  ).padStart(2, "0")}:${String(offsetAbs % 60).padStart(2, "0")}`;
}

async function getData(body) {
  const { data } = await axios.post(
    "https://api.tibber.com/v1-beta/gql",
    body,
    {
      headers: {
        Authorization: `Bearer ${process.env.TIBBER_PAT}`,
        "Content-Type": "application/json",
      },
    }
  );
  const formatted = {
    consumption: data.data.viewer.homes[0].consumption.nodes
      .map((item) => item.consumption)
      .reduce(sum, 0),
    production: data.data.viewer.homes[0].production.nodes
      .map((item) => item.production)
      .reduce(sum, 0),
  };
  return formatted;
}

function sum(result, item) {
  return result + item;
}

function sumFormatted(result, item) {
  return {
    consumption: result.consumption + item.consumption,
    production: result.production + item.production,
  };
}
