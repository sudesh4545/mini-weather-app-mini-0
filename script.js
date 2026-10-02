(function () {
        "use strict";
        var names = [
            "unit",
            "refresh",
            "locate",
            "query",
            "clear",
            "suggest",
            "status",
            "place",
            "updated",
            "save",
            "temperature",
            "unitLabel",
            "condition",
            "hi",
            "lo",
            "feels",
            "humidity",
            "wind",
            "rain",
            "sunrise",
            "weatherIcon",
            "saved",
            "savedCount",
            "savedEmpty",
            "zone",
            "chart",
            "hours",
            "days",
          ],
          e = {};
        names.forEach(function (x) {
          e[x] = document.getElementById(x);
        });
        var KEY = "stormglass:v1",
          prefs = { unit: "c", saved: [], recent: [] },
          current = null,
          timer,
          searchAbort,
          weatherAbort;
        try {
          prefs = Object.assign(
            prefs,
            JSON.parse(localStorage.getItem(KEY) || "{}"),
          );
        } catch (x) {}
        var desc = {
          0: ["Clear sky", "☀"],
          1: ["Mostly clear", "◒"],
          2: ["Partly cloudy", "☁"],
          3: ["Overcast", "☁"],
          45: ["Fog", "≋"],
          48: ["Icy fog", "≋"],
          51: ["Light drizzle", "⌁"],
          53: ["Drizzle", "⌁"],
          55: ["Heavy drizzle", "⌁"],
          61: ["Light rain", "☂"],
          63: ["Rain", "☂"],
          65: ["Heavy rain", "☂"],
          71: ["Light snow", "✣"],
          73: ["Snow", "✣"],
          75: ["Heavy snow", "✣"],
          80: ["Showers", "☂"],
          81: ["Showers", "☂"],
          82: ["Heavy showers", "☂"],
          95: ["Thunderstorm", "ϟ"],
          96: ["Storm with hail", "ϟ"],
          99: ["Storm with hail", "ϟ"],
        };
        function keep() {
          try {
            localStorage.setItem(KEY, JSON.stringify(prefs));
          } catch (x) {}
        }
        function w(c) {
          return desc[c] || ["Changing skies", "◌"];
        }
        function cv(c) {
          return Math.round(prefs.unit === "f" ? (c * 9) / 5 + 32 : c);
        }
        function u() {
          return prefs.unit === "f" ? "°F" : "°C";
        }
        function same(a, b) {
          return (
            Math.abs(a.latitude - b.latitude) < 0.01 &&
            Math.abs(a.longitude - b.longitude) < 0.01
          );
        }
        function note(s, bad) {
          e.status.textContent = s || "";
          e.status.style.color = bad ? "#ffc1cd" : "#a7ebff";
        }
        function esc(s) {
          return String(s).replace(/[&<>"']/g, function (c) {
            return {
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            }[c];
          });
        }
        async function json(url, signal) {
          var r = await fetch(url, { signal: signal });
          if (!r.ok) throw Error("Service error");
          return r.json();
        }
        async function search(term) {
          if (term.trim().length < 2) {
            e.suggest.hidden = true;
            return;
          }
          if (searchAbort) searchAbort.abort();
          searchAbort = new AbortController();
          try {
            var d = await json(
                "https://geocoding-api.open-meteo.com/v1/search?name=" +
                  encodeURIComponent(term.trim()) +
                  "&count=7&language=en&format=json",
                searchAbort.signal,
              ),
              list = d.results || [];
            e.suggest.innerHTML = list.length
              ? ""
              : '<p class="sub">No matching cities.</p>';
            list.forEach(function (loc) {
              var b = document.createElement("button");
              b.innerHTML =
                "<span>" +
                esc(loc.name) +
                "</span><small>" +
                esc([loc.admin1, loc.country].filter(Boolean).join(", ")) +
                "</small>";
              b.onclick = function () {
                e.suggest.hidden = true;
                e.query.value = "";
                load(loc);
              };
              e.suggest.appendChild(b);
            });
            e.suggest.hidden = false;
          } catch (x) {
            if (x.name !== "AbortError")
              note("City search is temporarily unavailable.", true);
          }
        }
        async function load(loc) {
          if (weatherAbort) weatherAbort.abort();
          weatherAbort = new AbortController();
          note("Reading live conditions…");
          var q = new URLSearchParams({
              latitude: loc.latitude,
              longitude: loc.longitude,
              timezone: "auto",
              forecast_days: "7",
              current:
                "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m",
              hourly: "temperature_2m,precipitation_probability,weather_code",
              daily:
                "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max",
            }),
            cache =
              "stormglass:cache:" +
              Number(loc.latitude).toFixed(2) +
              ":" +
              Number(loc.longitude).toFixed(2);
          try {
            var d = await json(
              "https://api.open-meteo.com/v1/forecast?" + q,
              weatherAbort.signal,
            );
            try {
              localStorage.setItem(
                cache,
                JSON.stringify({ at: Date.now(), data: d }),
              );
            } catch (x) {}
            render(loc, d, false);
            note("");
          } catch (x) {
            if (x.name === "AbortError") return;
            var old = null;
            try {
              old = JSON.parse(localStorage.getItem(cache) || "null");
            } catch (y) {}
            if (old) {
              render(loc, old.data, true, old.at);
              note("Offline — showing cached weather.", true);
            } else
              note("Weather could not be loaded. Check your connection.", true);
          }
        }
        function render(loc, d, stale, at) {
          current = { loc: loc, data: d };
          var c = d.current,
            day = d.daily,
            x = w(c.weather_code);
          e.place.textContent = [
            loc.name,
            loc.admin1 !== loc.name ? loc.admin1 : "",
            loc.country,
          ]
            .filter(Boolean)
            .join(", ");
          e.updated.textContent =
            (stale ? "Cached" : "Updated") +
            " · " +
            new Date(stale ? at : Date.now()).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
          e.temperature.textContent = cv(c.temperature_2m);
          e.unitLabel.textContent = u();
          e.condition.textContent = x[0];
          e.weatherIcon.textContent = x[1];
          e.hi.textContent = cv(day.temperature_2m_max[0]);
          e.lo.textContent = cv(day.temperature_2m_min[0]);
          e.feels.textContent = cv(c.apparent_temperature);
          e.humidity.textContent = c.relative_humidity_2m + "%";
          var compass=["N","NE","E","SE","S","SW","W","NW"];
          e.wind.textContent = Math.round(c.wind_speed_10m) + " km/h " + compass[Math.round((c.wind_direction_10m || 0)/45)%8];
          e.rain.textContent =
            (day.precipitation_probability_max[0] || 0) + "%";
          e.sunrise.textContent = day.sunrise[0].slice(-5) + " → " + day.sunset[0].slice(-5);
          e.zone.textContent = d.timezone_abbreviation || d.timezone;
          var saved = prefs.saved.some(function (a) {
            return same(a, loc);
          });
          e.save.textContent = saved ? "★" : "☆";
          e.save.style.color = saved ? "#ffd166" : "#fff";
          var item = {
            name: loc.name,
            admin1: loc.admin1 || "",
            country: loc.country || "",
            latitude: loc.latitude,
            longitude: loc.longitude,
          };
          prefs.recent = [item]
            .concat(
              prefs.recent.filter(function (a) {
                return !same(a, item);
              }),
            )
            .slice(0, 5);
          keep();
          draw(d);
          drawSaved();
        }
        function draw(d) {
          var start = d.hourly.time.findIndex(function (x) {
            return new Date(x).getTime() >= Date.now();
          });
          start = Math.max(0, start);
          var vals = d.hourly.temperature_2m.slice(start, start + 24),
            times = d.hourly.time.slice(start, start + 24),
            min = Math.min.apply(null, vals) - 2,
            max = Math.max.apply(null, vals) + 2,
            pts = vals.map(function (v, i) {
              return {
                x: 24 + (i * 672) / Math.max(vals.length - 1, 1),
                y: 150 - ((v - min) / (max - min || 1)) * 120,
              };
            }),
            path = pts
              .map(function (p, i) {
                return (i ? "L" : "M") + p.x.toFixed(1) + "," + p.y.toFixed(1);
              })
              .join(" ");
          e.chart.innerHTML =
            '<defs><linearGradient id="g"><stop stop-color="#38bdf8"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs><path d="' +
            path +
            '" fill="none" stroke="url(#g)" stroke-width="4" stroke-linecap="round"/>';
          e.hours.innerHTML = times
            .filter(function (_, i) {
              return i % 3 === 0;
            })
            .slice(0, 8)
            .map(function (x, i) {
              return (
                "<div><span>" +
                new Date(x).toLocaleTimeString([], { hour: "numeric" }) +
                "</span><br><b>" +
                cv(vals[i * 3]) +
                u() +
                "</b></div>"
              );
            })
            .join("");
          e.days.innerHTML = d.daily.time
            .map(function (date, i) {
              var x = w(d.daily.weather_code[i]);
              return (
                '<div class="day"><span>' +
                (i
                  ? " " +
                    new Date(date + "T12:00").toLocaleDateString([], {
                      weekday: "short",
                    })
                  : "Today") +
                "</span><i>" +
                x[1] +
                "</i><b>" +
                cv(d.daily.temperature_2m_max[i]) +
                "° <small>" +
                cv(d.daily.temperature_2m_min[i]) +
                "°</small></b><small>" +
                (d.daily.precipitation_probability_max[i] || 0) +
                "% rain</small></div>"
              );
            })
            .join("");
        }
        function drawSaved() {
          e.savedCount.textContent = prefs.saved.length + "/5";
          e.savedEmpty.hidden = !!prefs.saved.length;
          e.saved.innerHTML = "";
          prefs.saved.forEach(function (loc) {
            var b = document.createElement("button");
            b.innerHTML =
              "<span>" +
              esc(loc.name) +
              "<br><small>" +
              esc(loc.country || loc.admin1 || "Saved location") +
              "</small></span><b>→</b>";
            b.onclick = function () {
              load(loc);
            };
            e.saved.appendChild(b);
          });
        }
        e.query.oninput = function () {
          clearTimeout(timer);
          timer = setTimeout(function () {
            search(e.query.value);
          }, 280);
        };
        e.clear.onclick = function () {
          e.query.value = "";
          e.suggest.hidden = true;
          e.query.focus();
        };
        e.unit.onclick = function () {
          prefs.unit = prefs.unit === "c" ? "f" : "c";
          keep();
          if (current) render(current.loc, current.data, false);
        };
        e.refresh.onclick = function () {
          if (current) load(current.loc);
        };
        e.save.onclick = function () {
          if (!current) return;
          var i = prefs.saved.findIndex(function (a) {
            return same(a, current.loc);
          });
          if (i >= 0) prefs.saved.splice(i, 1);
          else if (prefs.saved.length < 5) prefs.saved.push(current.loc);
          else return note("Maximum five saved cities.", true);
          keep();
          render(current.loc, current.data, false);
        };
        e.locate.onclick = function () {
          if (!navigator.geolocation)
            return note("Location unavailable. Use city search.", true);
          note("Waiting for permission…");
          navigator.geolocation.getCurrentPosition(
            function (p) {
              load({
                name: "My location",
                latitude: p.coords.latitude,
                longitude: p.coords.longitude,
              });
            },
            function () {
              note("Location denied. City search still works.", true);
            },
            { timeout: 8000 },
          );
        };
        drawSaved();
        load(
          prefs.recent[0] || {
            name: "Delhi",
            admin1: "Delhi",
            country: "India",
            latitude: 28.6517,
            longitude: 77.2219,
          },
        );
      })();
