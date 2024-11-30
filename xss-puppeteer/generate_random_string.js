function Str_Random(length) {
  let random_result = "";
  const characters = "ABCabcdefghijklmnopqrstuvwxyz0123456789";

  // Loop to generate characters for the specified length
  for (let i = 0; i < length; i++) {
    const randomInd = Math.floor(Math.random() * characters.length);
    random_result += characters.charAt(randomInd);
  }
  return random_result;
}

module.exports = Str_Random;
