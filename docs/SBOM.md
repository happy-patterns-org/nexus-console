# Software Bill of Materials (SBOM)

Nexus Console generates Software Bill of Materials (SBOM) to provide transparency about the components and dependencies used in the project.

## What is SBOM?

A Software Bill of Materials (SBOM) is a formal record containing the details and supply chain relationships of various components used in building software. It's similar to a list of ingredients on food packaging.

## SBOM Generation

### Automatic Generation

SBOMs are automatically generated:

1. **On every security scan** - Part of the security workflow
2. **On every release** - Attached to GitHub releases
3. **On demand** - Using npm script

### Manual Generation

To generate SBOM manually:

```bash
# Generate SBOM in multiple formats
npm run sbom

# Generate and run security scan
npm run security:scan
```

## SBOM Formats

Nexus Console generates SBOMs in multiple industry-standard formats:

### CycloneDX

- **File**: `sbom/sbom-cyclonedx.json` (JSON format)
- **File**: `sbom/sbom-cyclonedx.xml` (XML format)
- **Standard**: [CycloneDX](https://cyclonedx.org/)
- **Use case**: Modern tooling, vulnerability scanning

### SPDX

- **File**: `sbom/sbom-spdx.json` (JSON format)
- **Standard**: [SPDX](https://spdx.dev/)
- **Use case**: License compliance, legal requirements

### Summary

- **File**: `sbom/sbom-summary.json`
- **Content**: Quick overview of components and dependencies

## SBOM Contents

The SBOM includes:

1. **Component Information**
   - Name and version
   - License information
   - Download location
   - Hash values (when available)

2. **Dependency Relationships**
   - Direct dependencies
   - Transitive dependencies
   - Dependency tree

3. **Metadata**
   - Generation timestamp
   - Tool information
   - Document version

## Using SBOM

### Vulnerability Scanning

```bash
# Scan SBOM for vulnerabilities using Grype
grype sbom:sbom/sbom-cyclonedx.json

# Scan with Trivy
trivy sbom sbom/sbom-cyclonedx.json
```

### License Compliance

```bash
# Check licenses using CycloneDX CLI
cyclonedx-cli analyze --input-file sbom/sbom-cyclonedx.json --output-format json

# Extract license information
jq '.components[].licenses' sbom/sbom-cyclonedx.json
```

### Supply Chain Verification

```bash
# Verify SBOM integrity
sha256sum sbom/sbom-cyclonedx.json

# Compare with known good SBOM
diff sbom/sbom-cyclonedx.json known-good-sbom.json
```

## CI/CD Integration

### GitHub Actions

SBOMs are generated automatically in CI/CD:

1. **Security Workflow** (`security.yml`)
   - Generates SBOM on every push
   - Includes vulnerability scanning
   - Uploads as artifacts

2. **Release Workflow** (`sbom-release.yml`)
   - Generates comprehensive SBOM
   - Attaches to GitHub releases
   - Creates SBOM attestation

### Accessing CI-Generated SBOMs

1. **From Workflow Artifacts**
   - Go to Actions tab
   - Select workflow run
   - Download SBOM artifacts

2. **From Releases**
   - Go to Releases page
   - Download SBOM files attached to release

## Security Considerations

1. **Regular Updates**
   - Generate new SBOM after dependency updates
   - Review changes between versions

2. **Vulnerability Monitoring**
   - Scan SBOM regularly
   - Monitor for new vulnerabilities

3. **Supply Chain Security**
   - Verify component sources
   - Check for known malicious packages

4. **Compliance**
   - Ensure license compatibility
   - Document component origins

## SBOM Tools

### Recommended Tools

1. **Generation**
   - [CycloneDX Node Module](https://github.com/CycloneDX/cyclonedx-node-module)
   - [Syft](https://github.com/anchore/syft)

2. **Scanning**
   - [Grype](https://github.com/anchore/grype)
   - [Trivy](https://github.com/aquasecurity/trivy)

3. **Analysis**
   - [SBOM Scorecard](https://github.com/eBay/sbom-scorecard)
   - [SPDX Tools](https://github.com/spdx/tools)

## Best Practices

1. **Generate Regularly**
   - After dependency updates
   - Before releases
   - As part of security audits

2. **Store Securely**
   - Version control SBOMs
   - Sign SBOMs for integrity
   - Archive historical SBOMs

3. **Review Changes**
   - Diff SBOMs between versions
   - Identify new components
   - Check license changes

4. **Automate Scanning**
   - Integrate with CI/CD
   - Set up alerts
   - Track vulnerabilities

## Example SBOM Usage

### Analyzing Dependencies

```bash
# Count total dependencies
jq '.components | length' sbom/sbom-cyclonedx.json

# List all licenses
jq '.components[].licenses[].license.id' sbom/sbom-cyclonedx.json | sort | uniq

# Find specific package
jq '.components[] | select(.name == "react")' sbom/sbom-cyclonedx.json
```

### Security Analysis

```bash
# Check for critical vulnerabilities
grype sbom:sbom/sbom-cyclonedx.json --fail-on critical

# Generate vulnerability report
grype sbom:sbom/sbom-cyclonedx.json -o json > vuln-report.json
```

## Troubleshooting

### Common Issues

1. **Generation Fails**
   - Ensure `npm install` completed
   - Check Node.js version
   - Verify script permissions

2. **Missing Dependencies**
   - Run `npm ci` to install exact versions
   - Check for private packages

3. **Invalid Format**
   - Validate with schema tools
   - Check for encoding issues

### Getting Help

For SBOM-related issues:
1. Check [GitHub Issues](https://github.com/business-org/nexus-console/issues)
2. Review CI logs
3. Validate SBOM format