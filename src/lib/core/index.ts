// Explicit private adapter contract. Framework packages copy/re-export public
// declarations from public-types; renderer internals are not a wildcard API.
export { BiasController } from "./BiasController";
export { createFieldController } from "./FieldController";
export { applyThemeVariables, themeVariableStyle } from "./theme-variables";
export type {
    ElementsController,
    ElementsConfig,
    InternalCollector,
    InternalFieldBinding,
    InternalFrameBinding,
    InternalFrameStateBinding,
} from "./adapter";
export type * from "./public-types";
export type { AddressMetadata, AddressSubdivision } from "./address-metadata";
export type { FieldController, FieldControllerOptions } from "./FieldController";
export type { FrameFieldType, ValueFieldType } from "./types";
export type { ThemeVariables } from "./theme-variables";
// Explicit renderer utilities. Core is private; these are not consumer SDK exports.
export { getCountryOptions } from "./address-metadata";
export { scopedField } from "./types";
export { validatePhone } from "./validation/phone";
export { ADDRESS_VALUE_FIELDS } from "./BiasStore";
