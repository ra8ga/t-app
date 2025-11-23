/** @type {import("prettier").Config} */
export default {
    plugins: ["prettier-plugin-tailwindcss"],
    tailwindFunctions: ["clsx", "cn", "cva"],
    tabWidth: 2,
    semi: true,
    singleQuote: true,
};
