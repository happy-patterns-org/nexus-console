#!/usr/bin/env node

/**
 * SBOM (Software Bill of Materials) Generator for Nexus Console
 * Generates SBOM in CycloneDX and SPDX formats
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure output directory exists
const outputDir = path.join(process.cwd(), 'sbom');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🔧 Generating Software Bill of Materials (SBOM)...\n');

// Generate CycloneDX SBOM
try {
  console.log('📦 Generating CycloneDX format SBOM...');
  
  // Install CycloneDX generator if not present
  try {
    execSync('npx @cyclonedx/cyclonedx-npm --version', { stdio: 'ignore' });
  } catch {
    console.log('Installing CycloneDX generator...');
    execSync('npm install -g @cyclonedx/cyclonedx-npm', { stdio: 'inherit' });
  }
  
  // Generate CycloneDX SBOM with fallback for missing dependencies
  try {
    execSync(
      `npx @cyclonedx/cyclonedx-npm --output-format json --output-file ${path.join(outputDir, 'sbom-cyclonedx.json')}`,
      { stdio: 'inherit' }
    );
    
    execSync(
      `npx @cyclonedx/cyclonedx-npm --output-format xml --output-file ${path.join(outputDir, 'sbom-cyclonedx.xml')}`,
      { stdio: 'inherit' }
    );
  } catch (npmError) {
    console.log('⚠️  npm ls failed, generating SBOM from package.json...');
    
    // Fallback: Generate basic CycloneDX from package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const cycloneDx = {
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      serialNumber: `urn:uuid:${require('crypto').randomUUID()}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: [{
          vendor: 'nexus-console',
          name: 'sbom-generator',
          version: '1.0.0'
        }],
        component: {
          type: 'application',
          bom_ref: packageJson.name,
          name: packageJson.name,
          version: packageJson.version,
          description: packageJson.description,
          licenses: [{ license: { id: packageJson.license } }]
        }
      },
      components: []
    };
    
    // Add dependencies
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    for (const [name, version] of Object.entries(allDeps)) {
      cycloneDx.components.push({
        type: 'library',
        bom_ref: name,
        name,
        version: version.replace(/[\^~]/, ''),
        purl: `pkg:npm/${name}@${version.replace(/[\^~]/, '')}`
      });
    }
    
    fs.writeFileSync(
      path.join(outputDir, 'sbom-cyclonedx.json'),
      JSON.stringify(cycloneDx, null, 2)
    );
    
    // Generate XML version (simplified)
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<bom xmlns="http://cyclonedx.org/schema/bom/1.4" version="1">
  <metadata>
    <timestamp>${new Date().toISOString()}</timestamp>
    <component type="application">
      <name>${packageJson.name}</name>
      <version>${packageJson.version}</version>
    </component>
  </metadata>
  <components>
${cycloneDx.components.map(comp => `    <component type="library">
      <name>${comp.name}</name>
      <version>${comp.version}</version>
      <purl>${comp.purl}</purl>
    </component>`).join('\n')}
  </components>
</bom>`;
    
    fs.writeFileSync(
      path.join(outputDir, 'sbom-cyclonedx.xml'),
      xmlContent
    );
  }
  
  console.log('✅ CycloneDX SBOM generated successfully');
} catch (error) {
  console.error('❌ Failed to generate CycloneDX SBOM:', error.message);
  process.exit(1);
}

// Generate SPDX SBOM
try {
  console.log('\n📦 Generating SPDX format SBOM...');
  
  // Create SPDX document manually (basic version)
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const spdxDoc = {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `${packageJson.name}-sbom`,
    documentNamespace: `https://github.com/business-org/nexus-console/sbom/${Date.now()}`,
    creationInfo: {
      created: new Date().toISOString(),
      creators: ['Tool: nexus-console-sbom-generator'],
      licenseListVersion: '3.20'
    },
    packages: [
      {
        SPDXID: 'SPDXRef-Package',
        name: packageJson.name,
        downloadLocation: packageJson.repository?.url || 'NOASSERTION',
        filesAnalyzed: false,
        version: packageJson.version,
        licenseConcluded: packageJson.license || 'NOASSERTION',
        licenseDeclared: packageJson.license || 'NOASSERTION',
        copyrightText: `Copyright ${new Date().getFullYear()} ${packageJson.author || 'NOASSERTION'}`
      }
    ],
    relationships: []
  };
  
  // Add dependencies as packages
  let packageIndex = 1;
  for (const [depName, depVersion] of Object.entries(dependencies)) {
    const depSPDXID = `SPDXRef-Package-${packageIndex++}`;
    
    spdxDoc.packages.push({
      SPDXID: depSPDXID,
      name: depName,
      version: depVersion.replace(/[\^~]/, ''),
      downloadLocation: `https://registry.npmjs.org/${depName}/-/${depName}-${depVersion.replace(/[\^~]/, '')}.tgz`,
      filesAnalyzed: false,
      licenseConcluded: 'NOASSERTION',
      licenseDeclared: 'NOASSERTION'
    });
    
    spdxDoc.relationships.push({
      spdxElementId: 'SPDXRef-Package',
      relationshipType: 'DEPENDS_ON',
      relatedSpdxElement: depSPDXID
    });
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'sbom-spdx.json'),
    JSON.stringify(spdxDoc, null, 2)
  );
  
  console.log('✅ SPDX SBOM generated successfully');
} catch (error) {
  console.error('❌ Failed to generate SPDX SBOM:', error.message);
  process.exit(1);
}

// Generate summary
try {
  console.log('\n📊 Generating SBOM summary...');
  
  const cycloneDxSbom = JSON.parse(fs.readFileSync(path.join(outputDir, 'sbom-cyclonedx.json'), 'utf-8'));
  const summary = {
    generated: new Date().toISOString(),
    format: ['CycloneDX', 'SPDX'],
    totalComponents: cycloneDxSbom.components?.length || 0,
    directDependencies: Object.keys(JSON.parse(fs.readFileSync('package.json', 'utf-8')).dependencies || {}).length,
    devDependencies: Object.keys(JSON.parse(fs.readFileSync('package.json', 'utf-8')).devDependencies || {}).length,
    files: [
      'sbom/sbom-cyclonedx.json',
      'sbom/sbom-cyclonedx.xml',
      'sbom/sbom-spdx.json',
      'sbom/sbom-summary.json'
    ]
  };
  
  fs.writeFileSync(
    path.join(outputDir, 'sbom-summary.json'),
    JSON.stringify(summary, null, 2)
  );
  
  console.log('✅ SBOM summary generated');
  console.log('\n📁 SBOM files generated in:', outputDir);
  console.log('   - sbom-cyclonedx.json (CycloneDX JSON format)');
  console.log('   - sbom-cyclonedx.xml (CycloneDX XML format)');
  console.log('   - sbom-spdx.json (SPDX JSON format)');
  console.log('   - sbom-summary.json (Summary report)');
  
} catch (error) {
  console.error('❌ Failed to generate summary:', error.message);
  process.exit(1);
}

console.log('\n✨ SBOM generation completed successfully!');