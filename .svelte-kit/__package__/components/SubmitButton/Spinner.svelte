<script lang="ts"></script>

<svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    stroke-linecap="round"
    fill="transparent"
    stroke-opacity="0.85"
    class="🔒 spinner bias:h-6 bias:w-6 bias:origin-center bias:p-[3px]"
    aria-hidden="true"
>
    <ellipse
        stroke="currentColor"
        stroke-width="2"
        stroke-dasharray="70"
        stroke-dashoffset="34"
        cx="12"
        cy="12"
        rx="10"
        ry="10"
    />
</svg>

<style>
    @keyframes spin {
        from {
            rotate: 0deg;
        }
        to {
            rotate: 360deg;
        }
    }

    .spinner {
        animation: spin 0.75s linear infinite;
    }
</style>
