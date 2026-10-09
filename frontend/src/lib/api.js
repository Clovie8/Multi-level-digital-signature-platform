import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Map to store AbortControllers for pending GET requests
const pendingControllers = new Map();

const originalGet = api.get;

api.get = function (url, config = {}) {
  const requestKey = `${url}?${new URLSearchParams(config.params || {}).toString()}`;
  
  // If there's an identical request pending, abort it (it belongs to the unmounted Strict Mode instance)
  if (pendingControllers.has(requestKey)) {
    const previousController = pendingControllers.get(requestKey);
    previousController.abort('dedupe');
  }

  const controller = new AbortController();
  // We must clone the config so we don't mutate a shared config object
  const newConfig = { ...config, signal: controller.signal };
  pendingControllers.set(requestKey, controller);

  return originalGet.call(api, url, newConfig)
    .catch(error => {
      if (axios.isCancel(error)) {
        // Return an empty promise to completely silence the old unmounted component
        return new Promise(() => {});
      }
      throw error;
    })
    .finally(() => {
      if (pendingControllers.get(requestKey) === controller) {
        pendingControllers.delete(requestKey);
      }
    });
};

export default api;