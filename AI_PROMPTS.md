
# Using AI Prompts in NetClip

NetClip's AI Prompt feature enhances your web clipping experience by allowing you to process and transform clipped content using customizable AI-driven instructions. This section guides you through setting up and using AI prompts, leveraging built-in variables, creating custom prompts, and troubleshooting common issues.

## Table of Contents
- [Getting Started](#getting-started)
- [Built-in Variable](#built-in-variable)
- [Creating Custom Prompts](#creating-custom-prompts)
- [Example Prompts](#example-prompts)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

To begin using AI prompts in NetClip, you’ll need to enable the feature and configure it with an [API key](https://aistudio.google.com/apikey). Follow these steps:

1. **Enable AI Prompt:**
   - Open Obsidian and go to **Settings > NetClip**.
   - Navigate to the **"AI Prompt"** tab.
   - Toggle **"Enable AI"** to **ON**.
   - Enter your [Get API key | Google AI Studio](https://aistudio.google.com/apikey)

2. **Access Prompts:**
   - Once AI is enabled, the **"AI Prompts"** section will appear in the NetClip settings.
   - Default example prompts are provided for immediate use.
   - You can use these as-is, modify them, or delete them to suit your needs.

---

## Built-in Variable

NetClip includes a special built-in variable, `${article}`, which automatically captures the extracted content (e.g., title, body text, metadata) from your web clips. This variable is pre-populated when you clip a webpage, making it easy to integrate into your prompts.

### Example Usage:
```json
Translate the following ${article} to ${target_lang}
```

In this prompt, `${article}` represents the clipped webpage content, and `${target_lang}` is a custom variable you define (e.g., "Japanese").

---

## Creating Custom Prompts

You can create your own prompts to tailor the AI’s behavior to your specific needs. Here’s how:

1. **Add a New Prompt:**
   - In the **AI prompt** tab of NetClip settings, click **"Add New Prompt"**.
   - Fill in the following fields:
     - **Name**: A short, descriptive name (e.g., "Summarize Article").
     - **Prompt**: The instruction for the AI, including variables (e.g., "Summarize ${article} in ${style} style").
     - **Variables**: Custom variables to make your prompt dynamic.

1. **Adding Variables(optional):**
   - Click **"Add Variable"**.
   - Enter a variable name (e.g., `style`) without the `${}` syntax you can add as many as you want.
   - Add possible values for the variable, one per line (e.g., `concise`, `detailed`).
   - Use the variable in your prompt as `${variableName}` (e.g., `${style}`).

3. **Saving and Testing:**
   - Save the prompt and test it by clipping a webpage and applying the prompt via the NetClip interface.


---

## Example Prompts

Below are three practical examples of custom prompts you can create in NetClip, formatted for easy copying with separate sections for each component, along with their use cases.

## 1. Translation Prompt

---
#### Prompt Name:
```
Translate Content
```
#### Prompt:
```
Translate the following ${article} to ${target_lang}
```
#### Variable Name:
```
target_lang
```
#### Variables:
```
     Japanese
     English
     Spanish
     French
     German
     Chinese
```

**Use Case**: Convert a clipped English article into Japanese for language practice.


## 2. Summarization Prompt

---
#### Prompt Name:
```
Summarize Content
```
#### Prompt:
```
Summarize ${article} in ${style} style. Keep the summary ${length}.
```
#### Variable Name:
```
style
```
#### Variables:
```
     concise
     detailed
     bullet points
     academic
```
#### Variable Name:
```
length
```
#### Variables:
```
     short (2-3 sentences)
     medium (1 paragraph)
     long (2-3 paragraphs)
```
**Use Case**: Summarize a long research article into a concise bullet-point list for quick reference.



### 3. Note Formatting Prompt
---

#### Prompt Name:
```
Format as Note
```
#### Prompt:
```
Convert ${article} into a structured note with headings, bullet points, and key takeaways. Use ${format} formatting style.
```
#### Variable Name:
```
format
```
#### Variables:
```
     Academic
     Meeting Notes
     Study Notes
```

**Use Case**: Turn a clipped blog post into a well-organized Markdown study note with key points highlighted.

---

## Troubleshooting

If you encounter issues with AI prompts, here are common problems and solutions:

1. **Prompt Not Working:**
   - **Check AI Status**: Ensure "Enable AI" is toggled on in settings.
   - **Verify API Key**: Confirm your Gemini API key is valid and correctly entered.
   - **Inspect Console**: Open the developer console (ctrl+shift+i)mac(cmd) to check for error messages.
   - **Variable Check**: Ensure all variables in the prompt are defined.

2. **Variable Issues:**
   - **Naming Consistency**: Variable names in the prompt (e.g., `${style}`) must match those in the variables section (e.g., `style`).
   - **Syntax**: Always wrap variables in `${}` within the prompt text.
   - **Value Selection**: Ensure all required variables have a selected value when running the prompt.

1. **Article Issues:**
   - **Long Content**: Very large articles may exceed API limits; try clipping smaller sections.
   - **Formatting Needs**: Add specific instructions (e.g., "convert to Markdown") if the output isn’t as expected.

4. **Common Errors:**
   - **"Variable not found"**: Double-check variable names and definitions.
   - **"AI Processing failed"**: Verify your API key and internet connection.
   - **"No response"**: Simplify the prompt or reduce content length if the article is too complex.

For further assistance or to report bugs, visit the [GitHub repository](https://github.com/Elhary/Obsidian-NetClip/issues) and open an issue.
