import { expect } from "vitest";

export function assertSubmitButtonStructure(container: HTMLElement) {
    const button = container.querySelector<HTMLButtonElement>("button[type='submit']");
    expect(button).toBeTruthy();
    return button!;
}
export const assertSubmitButtonLabel = (container: HTMLElement, label: string) =>
    expect(assertSubmitButtonStructure(container).textContent).toContain(label);
export const assertSubmitButtonDisabledState = (container: HTMLElement, disabled: boolean) =>
    expect(assertSubmitButtonStructure(container).disabled).toBe(disabled);
export const assertSubmitButtonAmount = (container: HTMLElement, amount: string) =>
    expect(assertSubmitButtonStructure(container).textContent).toContain(amount);
export const assertPaymentMethodCount = (container: HTMLElement, count: number) =>
    expect(
        Math.max(
            container.querySelectorAll("input[type='radio']").length,
            container.querySelectorAll("[role='tab']").length,
        ),
    ).toBe(count);
