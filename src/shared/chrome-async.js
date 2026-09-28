export function callChrome(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (result) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  });
}

export async function sendMessage(message) {
  return callChrome(chrome.runtime.sendMessage.bind(chrome.runtime), message);
}
