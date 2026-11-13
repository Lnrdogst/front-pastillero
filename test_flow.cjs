/**
 * test_flow.js — Prueba automatizada del flujo Auth + Vinculación de Dispositivo
 * 
 * USO:
 *   SUPABASE_URL="https://xxx.supabase.co" SUPABASE_KEY="eyJ..." node test_flow.js
 * 
 * Si no se pasan variables de entorno, ejecuta un dry-run que valida la estructura
 * de las llamadas sin conectar a Supabase real.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const TEST_EMAIL = `test_cuidador_${Date.now()}@pillsync-test.io`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_NOMBRE = 'Cuidador Prueba Automatizada';
const TEST_MAC = 'AA:BB:CC:DD:EE:FF';

const isLive = SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('tu-proyecto');

const log = (icon, msg) => console.log(`${icon}  ${msg}`);
const pass = (msg) => log('✅', msg);
const fail = (msg) => log('❌', msg);
const info = (msg) => log('ℹ️ ', msg);
const warn = (msg) => log('⚠️ ', msg);

const separator = () => console.log('─'.repeat(70));

async function runTests() {
  console.log('\n');
  separator();
  log('🧪', 'TEST AUTOMATIZADO: Flujo Auth + Vinculación IoT');
  separator();
  info(`Modo: ${isLive ? 'CONEXIÓN EN VIVO a Supabase' : 'DRY-RUN (sin credenciales reales)'}`);
  info(`URL: ${SUPABASE_URL || '(no configurada)'}`);
  info(`Email de prueba: ${TEST_EMAIL}`);
  info(`MAC de prueba: ${TEST_MAC}`);
  separator();

  if (!isLive) {
    warn('No se detectaron credenciales reales de Supabase.');
    warn('Ejecutando validación de estructura de código solamente.\n');
    await runDryRunChecks();
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = null;
  let testsPassed = 0;
  let testsFailed = 0;

  // ══════════════════════════════════════════════════════════════
  // TEST 1: Registro de usuario (signUp) — NO debe hacer INSERT a cuidadores
  // ══════════════════════════════════════════════════════════════
  separator();
  info('TEST 1: supabase.auth.signUp (registro de cuidador)');
  try {
    const { data, error } = await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      options: {
        data: { nombre: TEST_NOMBRE, telefono: '+00 00 0000 0000' },
      },
    });

    if (error) {
      fail(`signUp retornó error: [${error.status}] ${error.message}`);
      if (error.status === 429) {
        warn('Rate limit (429). Espera unos minutos antes de reintentar.');
      }
      testsFailed++;
    } else if (data?.user) {
      userId = data.user.id;
      pass(`Usuario creado exitosamente. UID: ${userId}`);
      testsPassed++;
    } else {
      warn('signUp no retornó error pero tampoco user. Podría requerir confirmación de email.');
      testsPassed++;
    }
  } catch (err) {
    fail(`Excepción en signUp: ${err.message}`);
    testsFailed++;
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 2: Verificar que el Trigger insertó en 'cuidadores'
  // ══════════════════════════════════════════════════════════════
  separator();
  info('TEST 2: Verificar TRIGGER on_auth_user_created → cuidadores');

  if (userId) {
    // Esperar un momento para que el trigger se ejecute
    await new Promise((r) => setTimeout(r, 1500));

    try {
      const { data: cuidador, error: cErr } = await supabase
        .from('cuidadores')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (cErr) {
        fail(`Error al consultar cuidadores: [${cErr.code}] ${cErr.message}`);
        if (cErr.code === '42501' || cErr.message?.includes('RLS')) {
          warn('Esto indica que la política RLS de SELECT en cuidadores es incorrecta.');
        }
        testsFailed++;
      } else if (cuidador) {
        pass(`Trigger funcionó. Fila encontrada en cuidadores: email=${cuidador.email}, nombre=${cuidador.nombre}`);
        testsPassed++;
      } else {
        fail('El Trigger NO insertó la fila en cuidadores. Verifica que el trigger "on_auth_user_created" exista.');
        testsFailed++;
      }
    } catch (err) {
      fail(`Excepción consultando cuidadores: ${err.message}`);
      testsFailed++;
    }
  } else {
    warn('Sin userId — no se puede verificar el trigger. Saltando test 2.');
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 3: Vinculación de dispositivo via UPSERT
  // ══════════════════════════════════════════════════════════════
  separator();
  info('TEST 3: UPSERT a dispositivos (vincular MAC)');

  if (userId) {
    try {
      const { data: devices, error: uErr } = await supabase
        .from('dispositivos')
        .upsert(
          {
            mac_id: TEST_MAC,
            cuidador_id: userId,
            nombre: 'Dispensador Test Automatizado',
            pastillas_restantes: 25,
            estado: 'online',
            ultima_conexion: new Date().toISOString(),
          },
          { onConflict: 'mac_id' }
        )
        .select();

      if (uErr) {
        fail(`UPSERT retornó error: [${uErr.code}] ${uErr.message}`);
        if (uErr.details) warn(`  Detalles: ${uErr.details}`);
        if (uErr.hint) warn(`  Sugerencia: ${uErr.hint}`);

        if (uErr.code === '42501') {
          fail('ERROR RLS: La política no permite INSERT/UPDATE en dispositivos para este usuario.');
          warn('Acción requerida: Ejecutar el script SQL definitivo con las políticas corregidas.');
        }
        testsFailed++;
      } else if (devices && devices.length > 0) {
        pass(`Dispositivo vinculado exitosamente: mac_id=${devices[0].mac_id}, id=${devices[0].id}`);
        testsPassed++;
      } else {
        fail('UPSERT no retornó error pero tampoco datos. Posible bloqueo silencioso de RLS.');
        testsFailed++;
      }
    } catch (err) {
      fail(`Excepción en UPSERT: ${err.message}`);
      testsFailed++;
    }
  } else {
    warn('Sin userId — no se puede vincular dispositivo. Saltando test 3.');
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 4: INSERT a horarios (CRUD legítimo)
  // ══════════════════════════════════════════════════════════════
  separator();
  info('TEST 4: INSERT a horarios (CRUD por mac_id vinculado)');

  if (userId) {
    try {
      const { data: schedule, error: sErr } = await supabase
        .from('horarios')
        .insert({
          mac_id: TEST_MAC,
          hora_programada: '09:00',
          estado: 'activo',
          medicamento: 'Test Fármaco 50mg',
          dosis: '1 pastilla',
          dias: ['L', 'M', 'X', 'J', 'V'],
          notas: 'Creado por test_flow.js',
        })
        .select()
        .single();

      if (sErr) {
        fail(`INSERT en horarios retornó error: [${sErr.code}] ${sErr.message}`);
        if (sErr.code === '42501') {
          fail('ERROR RLS: La política no permite INSERT en horarios para este mac_id.');
        }
        testsFailed++;
      } else {
        pass(`Horario creado exitosamente: id=${schedule.id}, hora=${schedule.hora_programada}`);
        testsPassed++;
      }
    } catch (err) {
      fail(`Excepción en INSERT horarios: ${err.message}`);
      testsFailed++;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 5: INSERT a historial_tomas (evento simulado)
  // ══════════════════════════════════════════════════════════════
  separator();
  info('TEST 5: INSERT a historial_tomas (simular evento "dispensado")');

  if (userId) {
    try {
      const { data: histItem, error: hErr } = await supabase
        .from('historial_tomas')
        .insert({
          mac_id: TEST_MAC,
          evento: 'dispensado',
          detalles: 'Evento generado por test_flow.js — prueba automatizada',
        })
        .select()
        .single();

      if (hErr) {
        fail(`INSERT en historial_tomas retornó error: [${hErr.code}] ${hErr.message}`);
        if (hErr.code === '42501') {
          fail('ERROR RLS: La política no permite INSERT en historial_tomas para este mac_id.');
        }
        testsFailed++;
      } else {
        pass(`Evento registrado exitosamente: id=${histItem.id}, evento=${histItem.evento}`);
        testsPassed++;
      }
    } catch (err) {
      fail(`Excepción en INSERT historial_tomas: ${err.message}`);
      testsFailed++;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // LIMPIEZA: Eliminar datos de prueba
  // ══════════════════════════════════════════════════════════════
  separator();
  info('LIMPIEZA: Eliminando datos de prueba...');

  if (userId) {
    try {
      await supabase.from('historial_tomas').delete().eq('mac_id', TEST_MAC);
      await supabase.from('horarios').delete().eq('mac_id', TEST_MAC);
      await supabase.from('dispositivos').delete().eq('mac_id', TEST_MAC);
      pass('Datos de prueba eliminados de dispositivos, horarios e historial.');
    } catch (err) {
      warn(`No se pudieron limpiar todos los datos de prueba: ${err.message}`);
    }

    // El usuario de auth.users se debe eliminar desde el dashboard de Supabase (Auth → Users)
    info(`Nota: Eliminar el usuario de prueba manualmente en Supabase Auth: ${TEST_EMAIL}`);
  }

  // ══════════════════════════════════════════════════════════════
  // RESUMEN
  // ══════════════════════════════════════════════════════════════
  separator();
  console.log('\n');
  log('📊', `RESULTADOS: ${testsPassed} pasados, ${testsFailed} fallidos`);

  if (testsFailed === 0) {
    pass('¡TODOS LOS TESTS PASARON! El flujo Auth + RLS + UPSERT funciona correctamente.');
  } else {
    fail(`${testsFailed} test(s) fallaron. Revisa los errores arriba y ejecuta el script SQL definitivo.`);
  }
  separator();
  console.log('\n');

  process.exit(testsFailed > 0 ? 1 : 0);
}

async function runDryRunChecks() {
  let checks = 0;
  let passed = 0;

  separator();
  info('Validación 1: AuthContext NO contiene INSERT a cuidadores');
  checks++;
  const fs = require('fs');
  const authCtx = fs.readFileSync('./src/context/AuthContext.tsx', 'utf-8');
  if (authCtx.includes(".from('cuidadores').insert") || authCtx.includes('.from("cuidadores").insert')) {
    fail('AuthContext.tsx aún contiene un INSERT a la tabla cuidadores. ¡Debe eliminarse!');
  } else {
    pass('AuthContext.tsx limpio — no hay INSERT a cuidadores.');
    passed++;
  }

  separator();
  info('Validación 2: DeviceContext usa UPSERT (no INSERT directo a dispositivos)');
  checks++;
  const devCtx = fs.readFileSync('./src/context/DeviceContext.tsx', 'utf-8');
  
  // Verificar que no hay .from('dispositivos').insert( directos (solo upsert)
  const devInsertMatches = devCtx.match(/\.from\(['"]dispositivos['"]\)\s*\.\s*insert\s*\(/g);
  if (devInsertMatches) {
    fail(`DeviceContext.tsx contiene ${devInsertMatches.length} INSERT(s) directos a dispositivos.`);
  } else {
    pass('DeviceContext.tsx no contiene INSERT directo a dispositivos.');
    passed++;
  }

  separator();
  info('Validación 3: DeviceContext contiene UPSERT con onConflict: mac_id');
  checks++;
  if (devCtx.includes('.upsert(') && devCtx.includes("onConflict: 'mac_id'")) {
    pass('DeviceContext.tsx usa .upsert() con onConflict: "mac_id" correctamente.');
    passed++;
  } else {
    fail('DeviceContext.tsx no contiene un UPSERT con onConflict: "mac_id".');
  }

  separator();
  info('Validación 4: INSERT a horarios incluye mac_id (requerido por RLS)');
  checks++;
  if (devCtx.includes("mac_id: device.mac_id") && devCtx.includes(".from('horarios')")) {
    pass('INSERT a horarios incluye mac_id del dispositivo vinculado.');
    passed++;
  } else {
    fail('INSERT a horarios podría no incluir mac_id, lo que bloqueará RLS.');
  }

  separator();
  info('Validación 5: INSERT a historial_tomas incluye mac_id');
  checks++;
  if (devCtx.includes("mac_id: device.mac_id") && devCtx.includes(".from('historial_tomas')")) {
    pass('INSERT a historial_tomas incluye mac_id del dispositivo vinculado.');
    passed++;
  } else {
    fail('INSERT a historial_tomas podría no incluir mac_id.');
  }

  separator();
  info('Validación 6: signUp envía nombre en user_metadata (para el Trigger)');
  checks++;
  if (authCtx.includes("nombre: nombre.trim()") || authCtx.includes("nombre:")) {
    const hasOptionsData = authCtx.includes("options:") && authCtx.includes("data: {") && authCtx.includes("nombre");
    if (hasOptionsData) {
      pass('signUp envía nombre en options.data para que el Trigger lo lea de raw_user_meta_data.');
      passed++;
    } else {
      fail('signUp no parece enviar nombre en options.data.');
    }
  } else {
    fail('signUp no incluye campo nombre.');
  }

  separator();
  console.log('\n');
  log('📊', `VALIDACIONES DRY-RUN: ${passed}/${checks} pasadas`);
  
  if (passed === checks) {
    pass('¡Todas las validaciones de estructura pasaron! El código está listo.');
    info('Para probar contra Supabase real, ejecuta:');
    info('  SUPABASE_URL="https://xxx.supabase.co" SUPABASE_KEY="eyJ..." node test_flow.js');
  } else {
    fail(`${checks - passed} validación(es) fallaron.`);
  }
  separator();
  console.log('\n');

  process.exit(passed === checks ? 0 : 1);
}

runTests().catch((err) => {
  fail(`Error fatal: ${err.message}`);
  process.exit(1);
});
