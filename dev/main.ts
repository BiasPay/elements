import { mount } from "svelte";
import App from "./App.svelte";
import "../src/lib/styles.css";
import "./styles.css";

const target = document.getElementById("app");
if (target) {
    mount(App, { target });
}
