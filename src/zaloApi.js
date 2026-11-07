const axios = require('axios');

const API_ROOT = 'https://bot-api.zaloplatforms.com';

function createZaloClient(token, http = axios) {
  async function call(method, body = {}) {
    const response = await http.post(`${API_ROOT}/bot${token}/${method}`, body, {
      timeout: 20000,
      validateStatus: () => true,
    });
    const data = response.data;
    if (!data?.ok) {
      throw new Error(`Zalo ${method}: ${data?.description || `HTTP ${response.status}`}`);
    }
    return data.result;
  }

  return {
    call,
    sendMessage: (chatId, text) => call('sendMessage', { chat_id: chatId, text }),
    sendPhoto: (chatId, photo, caption) => call('sendPhoto', {
      chat_id: chatId,
      photo,
      ...(caption ? { caption } : {}),
    }),
    sendTyping: (chatId) => call('sendChatAction', { chat_id: chatId, action: 'typing' }),
  };
}

module.exports = {
  API_ROOT,
  createZaloClient,
};
