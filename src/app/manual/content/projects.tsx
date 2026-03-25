export function ProjectsSection() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1>Projects</h1>
      <p className="lead text-muted-foreground">
        Projects are the top-level containers in MIAS-IO. All hardware configurations,
        signals, component instances, and network definitions are scoped to a project.
      </p>

      <h2>What is a Project?</h2>
      <p>
        A project represents a single automation installation &mdash; typically one vessel,
        building, or industrial facility. Every piece of data in MIAS-IO belongs to
        exactly one project, which means projects are fully isolated from each other.
        You can have multiple active projects running simultaneously.
      </p>
      <p>
        Each project tracks a <strong>revision</strong> identifier (A, B, C, ... Z, AA, AB, ...)
        that increments as the design evolves. Signals record which revision they were
        last modified in, providing a basic change audit trail.
      </p>

      <h2>Creating a Project</h2>
      <p>
        From the <strong>Projects</strong> page (the home page), click the <strong>New Project</strong> button.
        Fill in the following fields:
      </p>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Project Number</td>
            <td>No</td>
            <td>Your organization&apos;s internal project identifier (e.g., &quot;25425&quot;).</td>
          </tr>
          <tr>
            <td>Name</td>
            <td>Yes</td>
            <td>Descriptive name for the project (e.g., &quot;Lasse-Maja HVAC System&quot;).</td>
          </tr>
          <tr>
            <td>Client</td>
            <td>No</td>
            <td>The customer or owner of the installation.</td>
          </tr>
          <tr>
            <td>Location</td>
            <td>No</td>
            <td>Physical location of the installation.</td>
          </tr>
          <tr>
            <td>Status</td>
            <td>Yes</td>
            <td>Lifecycle status: Active, On Hold, Completed, or Archived. Defaults to Active.</td>
          </tr>
        </tbody>
      </table>

      <h2>Editing a Project</h2>
      <p>
        Click on any project in the list to open it. The project opens to
        the <strong>Details</strong> tab, where you can edit all fields. The sidebar
        provides navigation to three sections:
      </p>
      <ul>
        <li><strong>Details</strong> &mdash; Project metadata and approval assignment.</li>
        <li><strong>Hardware</strong> &mdash; The hardware tree showing PLCs, carriers, cards, and network topology.</li>
        <li><strong>Signals</strong> &mdash; The signal table for viewing and editing all project signals.</li>
      </ul>

      <h2>Project Approvals</h2>
      <p>
        Approvals are classification authority certifications (e.g., DNV GL, Lloyd&apos;s Register,
        Bureau Veritas) that constrain which hardware can be used in a project.
        When you assign approvals to a project, only catalog entries (PLCs, couplers,
        IO modules) that carry the same approval tags will appear in selection dialogs.
      </p>
      <p>
        To manage approvals, go to the <strong>Details</strong> tab of a project. The
        approval section shows toggle buttons for each available approval. Click a
        button to add or remove that approval from the project.
      </p>
      <p>
        If no approvals are assigned, all catalog entries are available (no filtering).
        This is appropriate for projects that do not require classification society compliance.
      </p>

      <h3>How Approval Filtering Works</h3>
      <ol>
        <li>Global <strong>Approval</strong> records are created in the admin area (e.g., &quot;DNV&quot;, &quot;LR&quot;).</li>
        <li>Hardware catalog entries (devices and modules) are tagged with the approvals they carry.</li>
        <li>A project selects which approvals are required via <strong>ProjectApproval</strong> join records.</li>
        <li>When adding hardware to the project, only catalog items whose approvals match or exceed the project&apos;s requirements are shown.</li>
      </ol>

      <h2>Project Members and Roles</h2>
      <p>
        Access to projects is controlled by membership and roles. There are two levels
        of role that affect what a user sees:
      </p>

      <h3>System Roles (User Level)</h3>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>ADMIN</strong></td>
            <td>Can see and edit all projects. Can manage users and global settings. Does not need to be a project member.</td>
          </tr>
          <tr>
            <td><strong>ENGINEER</strong></td>
            <td>Can only see projects where they are listed as a member. Can edit project data according to their member role.</td>
          </tr>
          <tr>
            <td><strong>VIEWER</strong></td>
            <td>Can only see projects where they are listed as a member. Read-only access.</td>
          </tr>
        </tbody>
      </table>

      <h3>Member Roles (Project Level)</h3>
      <p>
        Within a project, each member has a role that controls their editing permissions:
      </p>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>OWNER</strong></td>
            <td>Full control over the project. Can add/remove members, delete the project, and edit all data.</td>
          </tr>
          <tr>
            <td><strong>MEMBER</strong></td>
            <td>Can edit hardware, signals, and configuration within the project.</td>
          </tr>
          <tr>
            <td><strong>VIEWER</strong></td>
            <td>Read-only access to the project. Can view but not modify any data.</td>
          </tr>
        </tbody>
      </table>

      <h2>Deleting a Project</h2>
      <p>
        Projects can be deleted from the project list or the details page. Deletion is
        permanent and cascades to all project data: PLCs, carriers, cards, signals,
        networks, component instances, and all related records. There is no undo.
      </p>
      <p>
        Consider setting the status to <strong>Archived</strong> instead of deleting if
        you may need to reference the project later.
      </p>

      <h2>Project Status Lifecycle</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Active</strong></td>
            <td>The project is currently being worked on. This is the default status for new projects.</td>
          </tr>
          <tr>
            <td><strong>On Hold</strong></td>
            <td>Work is temporarily paused. The project remains editable.</td>
          </tr>
          <tr>
            <td><strong>Completed</strong></td>
            <td>The project design is finalized. The project remains editable for corrections.</td>
          </tr>
          <tr>
            <td><strong>Archived</strong></td>
            <td>The project is no longer actively used. It remains accessible but is hidden from the default project list.</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
