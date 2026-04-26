// Kotlin Support Extension — main.js
// Provides runtime commands for Kotlin development (JVM, Android, Ktor, Multiplatform)

const KOTLIN_PROJECT_TYPES = [
  { label: 'Console App (plain Kotlin)', value: 'console' },
  { label: 'Gradle Kotlin DSL', value: 'gradle-kts' },
  { label: 'Gradle Groovy', value: 'gradle-groovy' },
  { label: 'Maven Project', value: 'maven' },
  { label: 'Kotlin Multiplatform (KMP)', value: 'kmp' },
  { label: 'Ktor Server', value: 'ktor' },
  { label: 'Android + Compose', value: 'android-compose' },
];

const KTOR_DEPENDENCIES = [
  { label: 'Ktor Server Core (Netty)', value: 'ktor-server-core,ktor-server-netty' },
  { label: 'Ktor Server (CIO)', value: 'ktor-server-core,ktor-server-cio' },
  { label: 'Ktor Routing', value: 'ktor-server-core,ktor-server-routing' },
  { label: 'Ktor Content Negotiation (JSON)', value: 'ktor-server-content-negotiation,ktor-serialization-kotlinx-json' },
  { label: 'Ktor Auth JWT', value: 'ktor-server-auth,ktor-server-auth-jwt' },
  { label: 'Ktor HTML DSL', value: 'ktor-server-html-builder' },
  { label: 'Ktor WebSockets', value: 'ktor-server-websockets' },
  { label: 'Ktor Logging', value: 'ktor-server-call-logging' },
  { label: 'Ktor Metrics', value: 'ktor-server-metrics' },
  { label: 'Exposed SQL DSL', value: 'exposed-core,exposed-jdbc,exposed-dao' },
  { label: 'Koin DI', value: 'koin-ktor' },
  { label: 'Logback', value: 'logback-classic' },
];

const GRADLE_COMMON_DEPS = [
  { label: 'Kotlin Stdlib', value: 'org.jetbrains.kotlin:kotlin-stdlib' },
  { label: 'Kotlinx Coroutines Core', value: 'org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1' },
  { label: 'Kotlinx Serialization JSON', value: 'org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3' },
  { label: 'Ktor Client Core', value: 'io.ktor:ktor-client-core:3.0.0' },
  { label: 'Ktor Client CIO', value: 'io.ktor:ktor-client-cio:3.0.0' },
  { label: 'OkHttp', value: 'com.squareup.okhttp3:okhttp:4.12.0' },
  { label: 'Retrofit', value: 'com.squareup.retrofit2:retrofit:2.11.0' },
  { label: 'JUnit 5', value: 'org.junit.jupiter:junit-jupiter:5.11.0' },
  { label: 'MockK', value: 'io.mockk:mockk:1.13.12' },
  { label: 'AssertJ', value: 'org.assertj:assertj-core:3.26.3' },
  { label: 'SLF4J', value: 'org.slf4j:slf4j-api:2.0.16' },
  { label: 'Logback', value: 'ch.qos.logback:logback-classic:1.5.8' },
];

export function activate(context) {
  console.log('[kotlin-support] Extension activated');

  const api = context._api || globalThis.hyscode;
  if (!api) {
    console.warn('[kotlin-support] HysCode API not available');
    return;
  }

  if (!api.commands) return;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  async function runTerminal(cmd) {
    if (api.terminal && api.terminal.sendToActive) {
      await api.terminal.sendToActive(cmd);
    }
  }

  // ── New Kotlin Project ──────────────────────────────────────────────────────
  api.commands.register('kotlin.newProject', async () => {
    const type = await api.window?.showQuickPick?.(
      KOTLIN_PROJECT_TYPES,
      { placeHolder: 'Select project type' }
    );
    if (!type) return;

    const name = await api.window?.showInputBox?.({
      prompt: 'Project name',
      placeHolder: 'my-kotlin-app',
    });
    if (!name) return;

    const groupId = await api.window?.showInputBox?.({
      prompt: 'Group ID',
      placeHolder: 'com.example',
    }) || 'com.example';

    switch (type.value) {
      case 'console': {
        const pkg = groupId.replace(/\./g, '/');
        const content = `package ${groupId}

fun main() {
    println("Hello, Kotlin!")
}
`;
        const buildContent = `plugins {
    kotlin("jvm") version "2.0.20"
}

group = "${groupId}"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation(kotlin("stdlib"))
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}

kotlin {
    jvmToolchain(21)
}
`;
        if (api.workspace && api.workspace.createFile) {
          await api.workspace.createFile(`${name}/src/main/kotlin/${pkg}/Main.kt`, content);
          await api.workspace.createFile(`${name}/build.gradle.kts`, buildContent);
        }
        break;
      }
      case 'gradle-kts': {
        await runTerminal(`mkdir ${name} && cd ${name} && gradle init --type kotlin-application --dsl kotlin`);
        break;
      }
      case 'gradle-groovy': {
        await runTerminal(`mkdir ${name} && cd ${name} && gradle init --type kotlin-application --dsl groovy`);
        break;
      }
      case 'maven': {
        await runTerminal(`mvn archetype:generate -DgroupId=${groupId} -DartifactId=${name} -DarchetypeArtifactId=kotlin-archetype-jvm -DinteractiveMode=false`);
        break;
      }
      case 'kmp': {
        await runTerminal(`mkdir ${name} && cd ${name} && gradle init --type kotlin-multiplatform --dsl kotlin`);
        break;
      }
      case 'ktor': {
        const deps = await api.window?.showQuickPick?.(
          KTOR_DEPENDENCIES,
          { placeHolder: 'Select Ktor dependencies (press Enter to confirm)', canPickMany: true }
        );
        const depList = deps && deps.length > 0
          ? deps.map(d => d.value.split(',')).flat().filter(Boolean)
          : ['ktor-server-core', 'ktor-server-netty'];

        const depLines = depList.map(d => {
          if (d === 'logback-classic') return `    implementation("ch.qos.logback:logback-classic:1.5.8")`;
          return `    implementation("io.ktor:${d}:3.0.0")`;
        }).join('\n');

        const buildKts = `plugins {
    kotlin("jvm") version "2.0.20"
    id("io.ktor.plugin") version "3.0.0"
}

group = "${groupId}"
version = "1.0.0"

application {
    mainClass.set("${groupId}.ApplicationKt")
}

repositories {
    mavenCentral()
}

dependencies {
${depLines}
    testImplementation(kotlin("test"))
}
`;
        const appKt = `package ${groupId}

import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*

fun main() {
    embeddedServer(Netty, port = 8080) {
        module()
    }.start(wait = true)
}

fun Application.module() {
    routing {
        get("/") {
            call.respondText("Hello, Ktor!")
        }
    }
}
`;
        if (api.workspace && api.workspace.createFile) {
          await api.workspace.createFile(`${name}/src/main/kotlin/${groupId.replace(/\./g, '/')}/Application.kt`, appKt);
          await api.workspace.createFile(`${name}/build.gradle.kts`, buildKts);
        }
        break;
      }
      case 'android-compose': {
        await runTerminal(`mkdir ${name} && cd ${name} && gradle init --type kotlin-application --dsl kotlin`);
        break;
      }
      default:
        break;
    }
  });

  // ── New Gradle Kotlin DSL Project ───────────────────────────────────────────
  api.commands.register('kotlin.newGradleKtsProject', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Project name',
      placeHolder: 'my-kotlin-app',
    });
    if (!name) return;
    await runTerminal(`mkdir ${name} && cd ${name} && gradle init --type kotlin-application --dsl kotlin`);
  });

  // ── New Ktor Project ────────────────────────────────────────────────────────
  api.commands.register('kotlin.newKtorProject', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Project name',
      placeHolder: 'my-ktor-app',
    });
    if (!name) return;

    const deps = await api.window?.showQuickPick?.(
      KTOR_DEPENDENCIES,
      { placeHolder: 'Select Ktor dependencies', canPickMany: true }
    );
    const depList = deps && deps.length > 0
      ? deps.map(d => d.value.split(',')).flat().filter(Boolean)
      : ['ktor-server-core', 'ktor-server-netty'];

    const depLines = depList.map(d => {
      if (d === 'logback-classic') return `    implementation("ch.qos.logback:logback-classic:1.5.8")`;
      return `    implementation("io.ktor:${d}:3.0.0")`;
    }).join('\n');

    const buildKts = `plugins {
    kotlin("jvm") version "2.0.20"
    id("io.ktor.plugin") version "3.0.0"
}

group = "com.example"
version = "1.0.0"

application {
    mainClass.set("com.example.ApplicationKt")
}

repositories {
    mavenCentral()
}

dependencies {
${depLines}
    testImplementation(kotlin("test"))
}
`;
    const appKt = `package com.example

import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*

fun main() {
    embeddedServer(Netty, port = 8080) {
        module()
    }.start(wait = true)
}

fun Application.module() {
    routing {
        get("/") {
            call.respondText("Hello, Ktor!")
        }
    }
}
`;
    if (api.workspace && api.workspace.createFile) {
      await api.workspace.createFile(`${name}/src/main/kotlin/com/example/Application.kt`, appKt);
      await api.workspace.createFile(`${name}/build.gradle.kts`, buildKts);
    }
  });

  // ── New Kotlin Multiplatform Project ────────────────────────────────────────
  api.commands.register('kotlin.newKmpProject', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Project name',
      placeHolder: 'my-kmp-app',
    });
    if (!name) return;
    await runTerminal(`mkdir ${name} && cd ${name} && gradle init --type kotlin-multiplatform --dsl kotlin`);
  });

  // ── New Class ───────────────────────────────────────────────────────────────
  api.commands.register('kotlin.newClass', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Class name',
      placeHolder: 'MyClass',
    });
    if (!name) return;

    const pkg = await api.window?.showInputBox?.({
      prompt: 'Package',
      placeHolder: 'com.example',
    });

    const content = `package ${pkg || 'com.example'}

class ${name} {
}
`;
    if (api.workspace && api.workspace.createFile) {
      await api.workspace.createFile(`${name}.kt`, content);
    }
  });

  // ── New Data Class ──────────────────────────────────────────────────────────
  api.commands.register('kotlin.newDataClass', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Data class name',
      placeHolder: 'User',
    });
    if (!name) return;

    const pkg = await api.window?.showInputBox?.({
      prompt: 'Package',
      placeHolder: 'com.example',
    });

    const content = `package ${pkg || 'com.example'}

data class ${name}(
    val id: String,
    val name: String,
)
`;
    if (api.workspace && api.workspace.createFile) {
      await api.workspace.createFile(`${name}.kt`, content);
    }
  });

  // ── New Sealed Class ────────────────────────────────────────────────────────
  api.commands.register('kotlin.newSealedClass', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Sealed class name',
      placeHolder: 'Result',
    });
    if (!name) return;

    const pkg = await api.window?.showInputBox?.({
      prompt: 'Package',
      placeHolder: 'com.example',
    });

    const content = `package ${pkg || 'com.example'}

sealed class ${name} {
    data class Success(val data: String) : ${name}()
    data class Error(val message: String) : ${name}()
}
`;
    if (api.workspace && api.workspace.createFile) {
      await api.workspace.createFile(`${name}.kt`, content);
    }
  });

  // ── New Interface ───────────────────────────────────────────────────────────
  api.commands.register('kotlin.newInterface', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Interface name',
      placeHolder: 'MyService',
    });
    if (!name) return;

    const pkg = await api.window?.showInputBox?.({
      prompt: 'Package',
      placeHolder: 'com.example',
    });

    const content = `package ${pkg || 'com.example'}

interface ${name} {
    fun execute()
}
`;
    if (api.workspace && api.workspace.createFile) {
      await api.workspace.createFile(`${name}.kt`, content);
    }
  });

  // ── New Enum ────────────────────────────────────────────────────────────────
  api.commands.register('kotlin.newEnum', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Enum name',
      placeHolder: 'Status',
    });
    if (!name) return;

    const pkg = await api.window?.showInputBox?.({
      prompt: 'Package',
      placeHolder: 'com.example',
    });

    const content = `package ${pkg || 'com.example'}

enum class ${name} {
    ACTIVE,
    INACTIVE,
    PENDING;
}
`;
    if (api.workspace && api.workspace.createFile) {
      await api.workspace.createFile(`${name}.kt`, content);
    }
  });

  // ── New Object ──────────────────────────────────────────────────────────────
  api.commands.register('kotlin.newObject', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Object name',
      placeHolder: 'Singleton',
    });
    if (!name) return;

    const pkg = await api.window?.showInputBox?.({
      prompt: 'Package',
      placeHolder: 'com.example',
    });

    const content = `package ${pkg || 'com.example'}

object ${name} {
}
`;
    if (api.workspace && api.workspace.createFile) {
      await api.workspace.createFile(`${name}.kt`, content);
    }
  });

  // ── New Compose Screen ──────────────────────────────────────────────────────
  api.commands.register('kotlin.newComposeScreen', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Screen name (without Screen suffix)',
      placeHolder: 'Home',
    });
    if (!name) return;

    const pkg = await api.window?.showInputBox?.({
      prompt: 'Package',
      placeHolder: 'com.example.ui.screens',
    }) || 'com.example.ui.screens';

    const content = `package ${pkg}

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ${name}Screen(
    modifier: Modifier = Modifier,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("${name}") }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            Text("Hello, ${name}!")
        }
    }
}
`;
    if (api.workspace && api.workspace.createFile) {
      await api.workspace.createFile(`${name}Screen.kt`, content);
    }
  });

  // ── Run ─────────────────────────────────────────────────────────────────────
  api.commands.register('kotlin.run', async () => {
    console.log('[kotlin-support] Run');
    const file = api.editor?.getActiveFilePath?.();
    if (file && file.endsWith('.kt')) {
      // Try running via Gradle first (most common for Kotlin)
      await runTerminal('gradle run');
    } else {
      await runTerminal('gradle run');
    }
  });

  // ── Build ───────────────────────────────────────────────────────────────────
  api.commands.register('kotlin.build', async () => {
    console.log('[kotlin-support] Build');
    await runTerminal('gradle build');
  });

  // ── Test ────────────────────────────────────────────────────────────────────
  api.commands.register('kotlin.test', async () => {
    console.log('[kotlin-support] Test');
    await runTerminal('gradle test');
  });

  // ── Format ──────────────────────────────────────────────────────────────────
  api.commands.register('kotlin.fmt', async () => {
    console.log('[kotlin-support] Format');
    const file = api.editor?.getActiveFilePath?.();
    if (file && (file.endsWith('.kt') || file.endsWith('.kts'))) {
      await runTerminal(`ktlint -F "${file}"`);
    } else {
      await runTerminal('ktlint -F');
    }
  });

  // ── Wrap Selection with try/catch ───────────────────────────────────────────
  api.commands.register('kotlin.wrapTryCatch', async () => {
    if (!api.editor) return;
    const selection = api.editor.getSelection?.();
    if (!selection) return;
    const text = selection.text || '';
    const indented = text.split('\n').map(l => '        ' + l).join('\n');
    api.editor.replaceSelection?.(`try {\n${indented}\n    } catch (e: Exception) {\n        // handle error\n    }`);
  });

  // ── Generate Getter/Setter ──────────────────────────────────────────────────
  api.commands.register('kotlin.generateGetterSetter', async () => {
    const fieldName = await api.window?.showInputBox?.({
      prompt: 'Property name',
      placeHolder: 'name',
    });
    if (!fieldName) return;

    const fieldType = await api.window?.showInputBox?.({
      prompt: 'Property type',
      placeHolder: 'String',
    });
    if (!fieldType) return;

    const capitalized = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    const code = `    private var _${fieldName}: ${fieldType} = TODO()
    var ${fieldName}: ${fieldType}
        get() = _${fieldName}
        set(value) { _${fieldName} = value }`;

    if (api.editor && api.editor.insertAtCursor) {
      api.editor.insertAtCursor(code);
    }
  });

  // ── Add Gradle Dependency ───────────────────────────────────────────────────
  api.commands.register('kotlin.addDependency', async () => {
    const dep = await api.window?.showQuickPick?.(
      GRADLE_COMMON_DEPS,
      { placeHolder: 'Select dependency to add' }
    );
    if (!dep) return;

    const line = `    implementation("${dep.value}")`;

    api.window?.showInformationMessage?.(
      `Add to build.gradle.kts dependencies block:\n${line}`
    );
    console.log(`[kotlin-support] Gradle dependency: ${line}`);
  });

  // ── Gradle Commands ─────────────────────────────────────────────────────────
  api.commands.register('kotlin.gradleBuild', async () => {
    await runTerminal('gradle build');
  });

  api.commands.register('kotlin.gradleClean', async () => {
    await runTerminal('gradle clean');
  });

  api.commands.register('kotlin.gradleTest', async () => {
    await runTerminal('gradle test');
  });

  api.commands.register('kotlin.gradleRun', async () => {
    await runTerminal('gradle run');
  });

  console.log('[kotlin-support] Commands registered');

  // Settings tab
  if (api && api.settings?.updateTabContent) {
    api.settings.updateTabContent('kotlin-support.settings', {
      sections: [
        {
          title: 'Compiler',
          items: [
            { type: 'text', key: 'compilerPath', label: 'kotlinc Path', description: 'Path to kotlinc binary (empty = PATH)', placeholder: '/usr/local/bin/kotlinc', defaultValue: '' },
            { type: 'text', key: 'jdkPath', label: 'JDK Path', description: 'JDK used by Kotlin (empty = JAVA_HOME)', placeholder: '/usr/lib/jvm/java-21', defaultValue: '' },
            { type: 'select', key: 'jvmTarget', label: 'JVM Target', description: 'JVM target version for compilation', defaultValue: '21', options: [{ value: '1.8', label: 'Java 8' }, { value: '11', label: 'Java 11' }, { value: '17', label: 'Java 17' }, { value: '21', label: 'Java 21' }, { value: '23', label: 'Java 23' }] },
          ],
        },
        {
          title: 'Formatting',
          items: [
            { type: 'toggle', key: 'formatOnSave', label: 'Format on Save', description: 'Auto-format code on save', defaultValue: true },
            { type: 'select', key: 'linter', label: 'Linter', description: 'Default formatter/linter', defaultValue: 'ktlint', options: [{ value: 'ktlint', label: 'ktlint' }, { value: 'ktfmt', label: 'ktfmt (Google)' }, { value: 'none', label: 'None' }] },
          ],
        },
        {
          title: 'Features',
          items: [
            { type: 'toggle', key: 'coroutinesEnabled', label: 'Coroutines Snippets', description: 'Enable coroutine-related snippets', defaultValue: true },
            { type: 'toggle', key: 'composeEnabled', label: 'Compose Snippets', description: 'Enable Jetpack Compose snippets', defaultValue: false },
            { type: 'select', key: 'buildTool', label: 'Build Tool', description: 'Default build tool', defaultValue: 'gradle-kts', options: [{ value: 'gradle-kts', label: 'Gradle Kotlin DSL' }, { value: 'gradle-groovy', label: 'Gradle Groovy' }, { value: 'maven', label: 'Maven' }] },
          ],
        },
      ],
    });
  }
}

export function deactivate() {
  console.log('[kotlin-support] Extension deactivated');
}
