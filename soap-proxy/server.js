const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/login-eguj", async (req, res) => {
  const { username, password } = req.body;

  const soapXML = `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <LOGIN_EGUJFOREST xmlns="http://tempuri.org/">
        <UserName>${username}</UserName>
        <Password>${password}</Password>
      </LOGIN_EGUJFOREST>
    </soap:Body>
  </soap:Envelope>`;

  try {
    const response = await fetch(
      "https://egujforest.gujarat.gov.in/FMIS/CommonService/forestcommonservice.asmx",
      {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": "http://tempuri.org/LOGIN_EGUJFOREST",
        },
        body: soapXML,
      }
    );

    const text = await response.text();

    console.log("STATUS:", response.status);
    console.log("SOAP RESPONSE:", text);

    res.send(text);
  } catch (error) {
    console.error("SOAP FETCH ERROR:", error);
    res.status(500).json({
      error: "SOAP request failed",
      message: error.message,
    });
  }
});

app.listen(5000, () => {
  console.log("✅ SOAP Proxy running at http://localhost:5000");
});
