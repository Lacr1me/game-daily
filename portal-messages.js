import { MESSAGE_CONFIG } from "./message-config.js";
import { bindMessageForm } from "./message-client.js";

const form = document.querySelector("[data-message-form]");
if (form) bindMessageForm(form, { config: MESSAGE_CONFIG });
