# SEO Manager

## Overview

`SEO Manager` is a Node.js application designed to automate the SEO (Search Engine Optimization) metadata generation, validation, and publishing for blog posts. It integrates with the Halo CMS API and utilizes a Large Language Model (LLM) to intelligently generate optimized `metaTitle`, `metaDescription`, and `keywords` for articles, ensuring that this metadata adheres to SEO best practices. The core value of the project is to enhance content discoverability, reduce the burden on content creators to manually optimize SEO, and thereby improve the website's search engine rankings and traffic.

## Features

*   **Automated SEO Optimization**: Automatically generates SEO metadata for your articles.
*   **Halo CMS Integration**: Seamlessly integrates with the Halo CMS.
*   **LLM-Powered**: Uses a Large Language Model to generate high-quality SEO metadata.
*   **SEO Best Practices**: Validates the generated metadata against SEO best practices.
*   **Scheduled Tasks**: Runs on a schedule to keep your articles optimized.

## Getting Started

### Prerequisites

*   Node.js
*   npm
*   Halo CMS instance
*   OpenAI API key

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/your-username/seo-manager.git
    ```

2.  Install the dependencies:

    ```bash
    npm install
    ```

3.  Create a `.env` file in the root of the project and add the following variables:

    ```
    HALO_BASE_URL=<your-halo-site-url>
    HALO_API_TOKEN=<your-halo-api-token>
    OPENAI_API_KEY=<your-openai-api-key>
    OPENAI_BASE_URL=<your-openai-base-url>
    OPENAI_MODEL_NAME=<your-openai-model-name>
    ```

### Usage

To start the application, run the following command:

```bash
npm start
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## License

This project is licensed under the MIT License.
