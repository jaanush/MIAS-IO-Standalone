export function WiringRecipesSection() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1>Wiring Recipes</h1>
      <p className="lead text-muted-foreground">
        A wiring recipe describes how a function block should be instantiated and how
        each of its pins maps to component signals, literals, expressions, or related
        instances. The CODESYS plugin reads recipes during code generation and emits
        the corresponding FB declarations and parameter wiring.
      </p>

      <h2>Where to find them</h2>
      <p>
        Recipes are attached to a component template. Open a component
        (<code>/components/[id]</code>) and switch to the <strong>Wiring</strong> tab.
        The page lists every recipe defined on the template, grouped by layer, and
        lets you add, edit, or remove recipes and their parameters.
      </p>
      <p>
        Each recipe has four required fields:
      </p>
      <ul>
        <li><strong>Layer</strong> — which functional layer this recipe belongs to (see below).</li>
        <li><strong>Function Block</strong> — the FB type to instantiate (e.g. <code>FB_Pump</code>, <code>FB_HMI_Pump</code>).</li>
        <li><strong>Target GVL</strong> — which Global Variable List the FB instance is declared in.</li>
        <li><strong>Instance Name Pattern</strong> — a mustache template used to generate the instance name. Common patterns are <code>{"{{instance.tag}}"}</code> or <code>{"{{instance.tag}}_HMI"}</code>.</li>
      </ul>

      <h2>Wiring Layers</h2>
      <p>
        A single component template can carry multiple recipes that produce different
        function-block instances on top of the same physical signal set. The
        <strong>Layer</strong> selector partitions recipes into independent rails so
        the plugin can emit them into separate program organisation units without
        them stepping on each other:
      </p>
      <table>
        <thead>
          <tr>
            <th>Layer</th>
            <th>Typical use</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>CONTROL</strong></td>
            <td>The primary control FB for the device. Default for new recipes. There should be at most one CONTROL recipe per component.</td>
          </tr>
          <tr>
            <td><strong>HMI</strong></td>
            <td>An HMI viewmodel FB — typically wraps the CONTROL FB and exposes a flatter or differently-named pin set for the operator panel.</td>
          </tr>
          <tr>
            <td><strong>PMS</strong></td>
            <td>A power-management-system wrapper FB. Used when a genset, battery, or feeder participates in the PMS load-sharing logic.</td>
          </tr>
          <tr>
            <td><strong>HAL</strong></td>
            <td>Hardware-abstraction-layer FB. Sits between raw IO and the control FB; useful when you want a single place to invert polarities or apply pre-scaling.</td>
          </tr>
          <tr>
            <td><strong>ALARM</strong></td>
            <td>Alarm-supervision FB that consumes the control output and pushes alarms to the alarm system.</td>
          </tr>
        </tbody>
      </table>
      <p>
        On the Wiring tab, recipes appear under per-layer headings. Add a recipe via
        the <strong>Add Recipe</strong> button — the dialog has a Layer selector at
        the top. Recipes default to CONTROL.
      </p>

      <h2>Parameters</h2>
      <p>
        Click a recipe to expand it and see its parameter list. Each parameter has a
        name (matching an FB pin), a direction (<code>INPUT</code>, <code>OUTPUT</code>,
        or <code>VAR_IN_OUT</code>), and a <strong>source type</strong> that decides
        where the value comes from at codegen time.
      </p>
      <table>
        <thead>
          <tr>
            <th>Source Type</th>
            <th>What it resolves to</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>SIGNAL</strong></td>
            <td>The main scaled value of a component signal. Pick the signal by channel offset on the template; the plugin resolves it to the per-instance signal tag at codegen.</td>
          </tr>
          <tr>
            <td><strong>SIGNAL_RAW</strong></td>
            <td>Same signal, but the unscaled raw value (signal tag with <code>_RAW</code> suffix). Useful for HAL-layer wiring.</td>
          </tr>
          <tr>
            <td><strong>SIGNAL_SENSOR_FAULT</strong></td>
            <td>The signal&apos;s sensor-fault output (<code>_SensorFaultAlarm</code> suffix). Lets an alarm FB consume the fault flag without reading the value itself.</td>
          </tr>
          <tr>
            <td><strong>INSTANCE_FB</strong></td>
            <td>A reference to another FB instance on the same component instance. See &quot;Cross-layer references&quot; below.</td>
          </tr>
          <tr>
            <td><strong>CHILD_SIGNAL</strong></td>
            <td>A signal on a composite child instance — used when this recipe is defined on a composite parent template. You name a child role and the suffix of one of the child&apos;s signals; the plugin walks to the matching child instance and uses its real signal tag. See <em>Components &amp; Templates → Composite components</em>.</td>
          </tr>
          <tr>
            <td><strong>LITERAL</strong></td>
            <td>A fixed constant: <code>TRUE</code>, <code>0</code>, <code>3000</code>, etc.</td>
          </tr>
          <tr>
            <td><strong>EXPRESSION</strong></td>
            <td>A mustache template (<code>{"{{instance.tag}}"}</code>, <code>{"{{instance.name}}"}</code>) for free-form references to anything outside the standard wiring rails.</td>
          </tr>
        </tbody>
      </table>

      <h3>Importing FB pins automatically</h3>
      <p>
        If the project has an FB definition that matches the recipe&apos;s
        Function Block name (imported from a CODESYS project, see
        <em>CODESYS Integration → CODESYS Import</em>), an
        <strong>Import N FB Pins</strong> button appears next to the parameter list.
        It creates a parameter row for every pin on the FB and tries to auto-match
        each pin to a component signal whose tag suffix is similar (case-insensitive,
        underscores stripped, &gt;50% overlap). Matches default to <code>SIGNAL</code>
        source; you can refine afterwards.
      </p>

      <h2>Cross-layer references (INSTANCE_FB)</h2>
      <p>
        The most common reason to use multiple layers is so a wrapper FB
        (HMI / PMS / HAL / ALARM) can call into the underlying CONTROL FB. A pin
        with source type <code>INSTANCE_FB</code> on a non-CONTROL recipe automatically
        resolves to the same component instance&apos;s CONTROL recipe output.
      </p>
      <p>
        Concretely, when the plugin generates an HMI recipe and finds an
        <code>INSTANCE_FB</code> pin, it looks up the CONTROL recipe registered for
        the same component, applies its instance-name pattern to the current instance,
        and emits the resulting fully-qualified reference — e.g.
        <code>GVL_Control.BatteryPack_AFT</code>. The wrapper FB therefore receives a
        live reference to the control FB and can read its outputs or call its methods.
      </p>
      <p>
        If no CONTROL recipe is defined on the component, the resolver falls back to
        the component&apos;s declared function block plus the instance tag
        (<code>FB_Battery.BatteryPack_AFT</code>). This matches the convention used
        for hand-coded controls and means a wrapper can be added before a CONTROL
        recipe exists.
      </p>

      <h2>Variable substitution</h2>
      <p>
        Both the instance-name pattern and any <code>EXPRESSION</code>-source
        parameter support a small mustache vocabulary:
      </p>
      <ul>
        <li><code>{"{{instance.tag}}"}</code> — the instance&apos;s tag (e.g. <code>FW_Pump1</code>).</li>
        <li><code>{"{{instance.name}}"}</code> — the instance&apos;s human name.</li>
      </ul>
      <p>
        For <code>SIGNAL</code>-source parameters, you can also enter a tag pattern
        directly in the &quot;Or tag pattern&quot; field instead of picking a channel offset.
        This is useful when the recipe targets signals not modelled on the component
        template (e.g. PMS-injected variables).
      </p>

      <h2>What the plugin does with a recipe</h2>
      <ol>
        <li>For each component instance in the project, the plugin walks every recipe attached to the instance&apos;s component template.</li>
        <li>It expands the instance-name pattern to produce an FB instance name (e.g. <code>FW_Pump1</code>, <code>FW_Pump1_HMI</code>).</li>
        <li>It declares the FB instance in the recipe&apos;s target GVL.</li>
        <li>It resolves every parameter according to its source type and emits the wiring assignment.</li>
        <li>Recipes from different layers never collide because they live in different target GVLs and use different instance-name patterns.</li>
      </ol>
      <p>
        The result is that one component template can carry every FB wiring relevant
        to its devices — the control FB, the HMI viewmodel, the PMS wrapper, and any
        alarm supervisor — all generated from a single source of truth.
      </p>
    </article>
  );
}
