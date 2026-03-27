import axios from "axios";

const BASE_URL =
  "https://api.z-api.io/instances/3EBE8CF5956C114C4C79720A47A0C181/token/EFA4E4EC6A5F7DE5E82E8626";
const HEADERS = {
  "Content-Type": "application/json",
  "Client-Token": "SEU_CLIENT_TOKEN",
};

async function testTyping() {
  await axios.post(
    `${BASE_URL}/send-presence`,
    {
      phone: "33991261443",
      presence: "composing",
    },
    { headers: HEADERS },
  );

  console.log("enviado");
}

testTyping();
