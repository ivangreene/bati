import { assert, test } from "vitest";
import { parseModule } from "magicast";
import { renderSquirrelly, transformAstAndGenerate, transformAst } from "../src/parse.js";
import { assertEquivalentAst } from "../src/testUtils.js";
import type { VikeMeta } from "../src/types.js";

function ast(code: string) {
  return parseModule(code).$ast;
}

function testAst(code: string, meta: VikeMeta) {
  const tree = ast(code);

  return transformAst(tree, meta);
}

test("ast includes:react", () => {
  const tree = testAst(
    `if (import.meta.BATI_MODULES.includes("framework:react")) {
    content = { ...content, jsx: "react" };
  }`,
    {
      BATI_MODULES: ["framework:react"],
    },
  );

  assertEquivalentAst(
    tree,
    ast(
      `
      content = {
        ...content,
        jsx: "react"
      };
    `,
    ),
  );
});

test("ast includes:solid", () => {
  const tree = testAst(
    `if (import.meta.BATI_MODULES.includes("framework:react")) {
    content = { ...content, jsx: "react" };
  }`,
    {
      BATI_MODULES: ["framework:solid"],
    },
  );

  assertEquivalentAst(tree, ast(""));
});

test("ast if-elseif-else:react", () => {
  const tree = testAst(
    `if (import.meta.BATI_MODULES.includes("framework:react")) {
      content = { ...content, jsx: "react" };
    } else if (import.meta.BATI_MODULES.includes("framework:solid")) {
      content = { ...content, jsx: "preserve", jsxImportSource: "solid-js" };
    } else {
      console.log('NOTHING TO DO');
    }`,
    {
      BATI_MODULES: ["framework:react"],
    },
  );

  assertEquivalentAst(tree, ast(`content = { ...content, jsx: "react" };`));
});

test("ast if-elseif-else:solid", () => {
  const tree = testAst(
    `if (import.meta.BATI_MODULES.includes("framework:react")) {
      content = { ...content, jsx: "react" };
    } else if (import.meta.BATI_MODULES.includes("framework:solid")) {
      content = { ...content, jsx: "preserve", jsxImportSource: "solid-js" };
    } else {
      console.log('NOTHING TO DO');
    }`,
    {
      BATI_MODULES: ["framework:solid"],
    },
  );

  assertEquivalentAst(tree, ast(`content = { ...content, jsx: "preserve", jsxImportSource: "solid-js" };`));
});

test("ast if-elseif-else:other", () => {
  const tree = testAst(
    `if (import.meta.BATI_MODULES.includes("framework:react")) {
      content = { ...content, jsx: "react" };
    } else if (import.meta.BATI_MODULES.includes("framework:solid")) {
      content = { ...content, jsx: "preserve", jsxImportSource: "solid-js" };
    } else {
      console.log('NOTHING TO DO');
    }`,
    {
      BATI_MODULES: ["framework:vue"],
    },
  );

  assertEquivalentAst(tree, ast(`console.log('NOTHING TO DO');`));
});

test("ast external variable", () => {
  assert.throws(
    () =>
      testAst(
        `if (import.meta.BATI_MODULES.includes(someVar)) {
    content = { ...content, jsx: "react" };
  }`,
        {
          BATI_MODULES: ["framework:react"],
        },
      ),
    ReferenceError,
  );
});

test("ast ternary:react", () => {
  const tree = testAst(
    `import.meta.BATI_MODULES.includes("framework:react")
    ? 1
    : import.meta.BATI_MODULES.includes("framework:solid")
    ? 2
    : null`,
    {
      BATI_MODULES: ["framework:react"],
    },
  );

  assertEquivalentAst(tree, ast(`1`));
});

test("ast ternary:solid", () => {
  const tree = testAst(
    `import.meta.BATI_MODULES.includes("framework:react")
    ? 1
    : import.meta.BATI_MODULES.includes("framework:solid")
    ? 2
    : null`,
    {
      BATI_MODULES: ["framework:solid"],
    },
  );

  assertEquivalentAst(tree, ast(`2`));
});

test("ast ternary:other", () => {
  const tree = testAst(
    `import.meta.BATI_MODULES.includes("framework:react")
    ? 1
    : import.meta.BATI_MODULES.includes("framework:solid")
    ? 2
    : null`,
    {
      BATI_MODULES: ["framework:vue"],
    },
  );

  assertEquivalentAst(tree, ast(`null`));
});

test("ast import cleanup:react", async () => {
  const code = await transformAstAndGenerate(
    ast(
      `
    import { solid } from 'solid';
    import react from 'react';
    
    export const framework = import.meta.BATI_MODULES.includes("framework:react")
    ? react()
    : import.meta.BATI_MODULES.includes("framework:solid")
    ? solid()
    : null;
    `,
    ),
    {
      BATI_MODULES: ["framework:react"],
    },
  );

  assertEquivalentAst(
    ast(code),
    ast(
      `import react from 'react';
    export const framework = react();`,
    ),
  );
});

test("ast import cleanup:solid", async () => {
  const code = await transformAstAndGenerate(
    ast(
      `
    import { solid } from 'solid';
    import react from 'react';
    
    export const framework = import.meta.BATI_MODULES.includes("framework:react")
    ? react()
    : import.meta.BATI_MODULES.includes("framework:solid")
    ? solid()
    : null;
    `,
    ),
    {
      BATI_MODULES: ["framework:solid"],
    },
  );

  assertEquivalentAst(
    ast(code),
    ast(
      `import { solid } from 'solid';
    export const framework = solid();`,
    ),
  );
});

test("ast import cleanup:other", async () => {
  const code = await transformAstAndGenerate(
    ast(
      `
    import { solid } from 'solid';
    import react from 'react';
    
    export const framework = import.meta.BATI_MODULES.includes("framework:react")
    ? react()
    : import.meta.BATI_MODULES.includes("framework:solid")
    ? solid()
    : null;
    `,
    ),
    {
      BATI_MODULES: ["framework:vue"],
    },
  );

  assertEquivalentAst(ast(code), ast(`export const framework = null;`));
});

test("ast remove BATI_REMOVE", () => {
  const tree = transformAst(ast(`const a = [import.meta.BATI_REMOVE, 'a']`), {
    BATI_MODULES: ["framework:vue"],
  });

  assertEquivalentAst(tree, ast(`const a = ['a']`));
});

test("ast remove comment preceding import", () => {
  const tree = transformAst(
    ast(`
//# import.meta.BATI_MODULES?.includes("uikit:tailwindcss")
import "./tailwind.css";`),
    {
      BATI_MODULES: ["uikit:tailwindcss"],
    },
  );

  assertEquivalentAst(tree, ast(`import "./tailwind.css";`));
});

test("ast remove comment preceding import and import itself", () => {
  const tree = transformAst(
    ast(`
//# import.meta.BATI_MODULES?.includes("uikit:tailwindcss")
import "./tailwind.css";`),
    {
      BATI_MODULES: [],
    },
  );

  assertEquivalentAst(tree, ast(``));
});

test("ast remove comment preceding JSX attribute", () => {
  const tree = transformAst(
    ast(`
<div
  id="sidebar"
  //# import.meta.BATI_MODULES?.includes("uikit:tailwindcss")
  class="p-5 flex flex-col shrink-0 border-r-2 border-r-gray-200"
  //# !import.meta.BATI_MODULES?.includes("uikit:tailwindcss")
  style={{
    padding: "20px",
    "flex-shrink": 0,
    display: "flex",
    "flex-direction": "column",
    "line-height": "1.8em",
    "border-right": "2px solid #eee"
  }}
>
  {props.children}
</div>`),
    {
      BATI_MODULES: [],
    },
  );

  assertEquivalentAst(
    tree,
    ast(`
<div
  id="sidebar"
  style={{
    padding: "20px",
    "flex-shrink": 0,
    display: "flex",
    "flex-direction": "column",
    "line-height": "1.8em",
    "border-right": "2px solid #eee"
  }}
>
  {props.children}
</div>`),
  );
});

test("ast remove comment preceding JSX attribute", () => {
  const tree = transformAst(
    ast(`
<div
  id="sidebar"
  //# import.meta.BATI_MODULES?.includes("uikit:tailwindcss")
  class="p-5 flex flex-col shrink-0 border-r-2 border-r-gray-200"
  //# !import.meta.BATI_MODULES?.includes("uikit:tailwindcss")
  style={{
    padding: "20px",
    "flex-shrink": 0,
    display: "flex",
    "flex-direction": "column",
    "line-height": "1.8em",
    "border-right": "2px solid #eee"
  }}
>
  {props.children}
</div>`),
    {
      BATI_MODULES: ["uikit:tailwindcss"],
    },
  );

  assertEquivalentAst(
    tree,
    ast(`
<div
  id="sidebar"
  class="p-5 flex flex-col shrink-0 border-r-2 border-r-gray-200"
>
  {props.children}
</div>`),
  );
});

test("squirrelly if telefunc", async () => {
  const renderedOutput = renderSquirrelly(
    `
<template>
  <div class="layout">
    <Sidebar>
      <Logo />
      <Link href="/">Welcome</Link>
{{ @if (it.import.meta.BATI_MODULES?.includes("rpc:telefunc")) }}
      <Link href="/todo">Todo</Link>
{{ /if }}
      <Link href="/star-wars">Data Fetching</Link>
    </Sidebar>
    <Content><slot /></Content>
  </div>
</template>`,
    {
      BATI_MODULES: ["uikit:tailwindcss", "rpc:telefunc"],
    },
  );

  assert.equal(
    renderedOutput,
    `
<template>
  <div class="layout">
    <Sidebar>
      <Logo />
      <Link href="/">Welcome</Link>
      <Link href="/todo">Todo</Link>
      <Link href="/star-wars">Data Fetching</Link>
    </Sidebar>
    <Content><slot /></Content>
  </div>
</template>`,
  );
});

test("squirrelly if not telefunc", async () => {
  const renderedOutput = renderSquirrelly(
    `
<template>
  <div class="layout">
    <Sidebar>
      <Logo />
      <Link href="/">Welcome</Link>
{{ @if (it.import.meta.BATI_MODULES?.includes("rpc:telefunc")) }}
      <Link href="/todo">Todo</Link>
{{ /if }}
      <Link href="/star-wars">Data Fetching</Link>
    </Sidebar>
    <Content><slot /></Content>
  </div>
</template>`,
    {
      BATI_MODULES: ["uikit:tailwindcss"],
    },
  );

  assert.equal(
    renderedOutput,
    `
<template>
  <div class="layout">
    <Sidebar>
      <Logo />
      <Link href="/">Welcome</Link>
      <Link href="/star-wars">Data Fetching</Link>
    </Sidebar>
    <Content><slot /></Content>
  </div>
</template>`,
  );
});

test("squirrelly if-else tailwind", async () => {
  const renderedOutput = renderSquirrelly(
    `
<template>
  <div id="page-container">
    <div
      id="page-content"
{{ @if (it.import.meta.BATI_MODULES?.includes("uikit:tailwindcss")) }}
      class="p-5 pb-12 min-h-screen"
{{ #else }}
      style="
        padding: 20px;
        padding-bottom: 50px;
        min-height: 100vh;
      "
{{ /if }}
    >
      <slot />
    </div>
  </div>
</template>`,
    {
      BATI_MODULES: ["uikit:tailwindcss"],
    },
  );

  assert.equal(
    renderedOutput,
    `
<template>
  <div id="page-container">
    <div
      id="page-content"
      class="p-5 pb-12 min-h-screen"
    >
      <slot />
    </div>
  </div>
</template>`,
  );
});

test("squirrelly if-else not tailwind", async () => {
  const renderedOutput = renderSquirrelly(
    `
<template>
  <div id="page-container">
    <div
      id="page-content"
{{ @if (it.import.meta.BATI_MODULES?.includes("uikit:tailwindcss")) }}
      class="p-5 pb-12 min-h-screen"
{{ #else }}
      style="
        padding: 20px;
        padding-bottom: 50px;
        min-height: 100vh;
      "
{{ /if }}
    >
      <slot />
    </div>
  </div>
</template>`,
    {},
  );

  assert.equal(
    renderedOutput,
    `
<template>
  <div id="page-container">
    <div
      id="page-content"
      style="
        padding: 20px;
        padding-bottom: 50px;
        min-height: 100vh;
      "
    >
      <slot />
    </div>
  </div>
</template>`,
  );
});

test("squirrelly comments", async () => {
  const renderedOutput = renderSquirrelly(
    `
{{! /* We are using the SquirrellyJS template syntax */ _}}

<!-- Default <head> (can be overridden by pages) -->

<template>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</template>`,
    {},
  );

  assert.equal(
    renderedOutput,
    `
<!-- Default <head> (can be overridden by pages) -->

<template>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</template>`,
  );
});
