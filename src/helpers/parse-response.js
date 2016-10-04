export default function parseResponse(res) {
  return res.text().then((resText) => {
    const response = res;

    if (!response.ok) {
      const error = new Error(response.statusText);
      error.status = response.status;

      throw error;
    }

    try {
      response.bodyParsed = JSON.parse(resText);
    } catch (e) {
      response.bodyParsed = resText;
    }

    return response;
  });
}
