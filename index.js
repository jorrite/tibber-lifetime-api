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

  const { status, formatted } = await getYearlyData();

  send(res, status, formatted);
};

const server = new http.Server(serve(handler));

server.on("listening", () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});
server.on("error", (error) => {
  console.error(error);
});

server.listen(Number(process.env.PORT));

async function getYearlyData() {
  const body = {
    query: `{
    viewer {
      homes {
        consumption(resolution: ANNUAL, first: 100, filterEmptyNodes: true) {
          nodes {
            consumption
          }
        }
        production(resolution: ANNUAL, first: 100,  filterEmptyNodes: true) {
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
  return { status: 200, formatted };
}

function sum(result, item) {
  return result + item;
}
