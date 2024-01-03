import { HandleTwitterApiResponse } from "../parsers/request.js";
import "./startup.ts";

document.addEventListener("blue-blocker-event", (e: CustomEvent<TwitterApiResponse>) => HandleTwitterApiResponse(e.detail));
