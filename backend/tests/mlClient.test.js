jest.mock("axios", () => ({ post: jest.fn() }));

const axios = require("axios");
const { postToMl } = require("../services/mlClient");

describe("Client interne ML", () => {
  const previousSecret = process.env.ML_SERVICE_SECRET;
  const previousUrl = process.env.ML_SERVICE_URL;
  const previousInteractionUrl = process.env.ML_EXPERIMENTAL_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ML_SERVICE_SECRET = "secret-de-test";
    delete process.env.ML_SERVICE_URL;
    delete process.env.ML_EXPERIMENTAL_URL;
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.ML_SERVICE_SECRET;
    else process.env.ML_SERVICE_SECRET = previousSecret;
    if (previousUrl === undefined) delete process.env.ML_SERVICE_URL;
    else process.env.ML_SERVICE_URL = previousUrl;
    if (previousInteractionUrl === undefined) delete process.env.ML_EXPERIMENTAL_URL;
    else process.env.ML_EXPERIMENTAL_URL = previousInteractionUrl;
  });

  test("transmet l'identifiant serveur et le secret aux deux opérations", async () => {
    axios.post.mockResolvedValue({ data: {} });
    await postToMl("train", { data: [] }, 7);
    await postToMl("predict", { ratio_favoris: 0.5 }, 8);

    expect(axios.post).toHaveBeenNthCalledWith(1, "http://127.0.0.1:8001/train", { data: [] }, {
      headers: { "X-FITS-ML-SECRET": "secret-de-test", "X-FITS-USER-ID": "7" }, timeout: 15000
    });
    expect(axios.post).toHaveBeenNthCalledWith(2, "http://127.0.0.1:8001/predict", { ratio_favoris: 0.5 }, {
      headers: { "X-FITS-ML-SECRET": "secret-de-test", "X-FITS-USER-ID": "8" }, timeout: 2000
    });
  });

  test.each([undefined, 0, -1, 1.2, "7", 2147483648, Number.MAX_SAFE_INTEGER + 1])(
    "refuse un identifiant non fiable : %s", userId => {
      expect(() => postToMl("predict", {}, userId)).toThrow("Identifiant utilisateur ML invalide");
      expect(axios.post).not.toHaveBeenCalled();
    }
  );

  test("refuse d'appeler un service sans secret configuré", () => {
    delete process.env.ML_SERVICE_SECRET;
    expect(() => postToMl("predict", {}, 7)).toThrow("ML_SERVICE_SECRET non configuré");
    expect(axios.post).not.toHaveBeenCalled();
  });
});
