let path   = require("path");
let nconf  = require("nconf");
let routes = [];

routes.push({
  meta: {
    method: "GET",
    path: "/sockethub-client.js"
  },
  route: function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(path.resolve(__dirname + "/../lib/client.js"));
  }
},

  {
    meta: {
      method: "GET",
      path: "/socket.io.js"
    },
    route: function (req, res) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.sendFile(path.resolve(__dirname + "/../node_modules/socket.io-client/dist/socket.io.js"));
    }
  },

  {
    meta: {
      method: "GET",
      path: "/activity-streams.js"
    },
    route: function (req, res) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.sendFile(path.resolve(__dirname + "/../node_modules/activity-streams/browser/activity-streams.js"));
    }
  },

  {
    meta: {
      method: "GET",
      path: "/activity-streams.min.js"
    },
    route: function (req, res) {
      res.sendFile(path.resolve(__dirname + "/../node_modules/activity-streams/browser/activity-streams.min.js"));
    }
  });

if (nconf.get("examples:enabled")) {
  routes.push({
    meta: {
      method: "GET",
      path: "/"
    },
    route: function (req, res) {
      res.render("index.ejs");
    }
  },

    {
      meta: {
        method: "GET",
        path: "/jquery.js"
      },
      route: function (req, res) {
        res.sendFile(path.resolve(__dirname + "/../node_modules/jquery/dist/jquery.min.js"));
      }
    },

    {
      meta: {
        method: "GET",
        path: "/jquery.min.map"
      },
      route: function (req, res) {
        res.sendFile(path.resolve(__dirname + "/../node_modules/jquery/dist/jquery.min.map"));
      }
    });
}

/**
 * Setup
 */

exports.setup = function (app) {
  routes.forEach(function (route) {
    app[route.meta.method.toLowerCase()](
      route.meta.path,
      route.route
    );
  });
};
