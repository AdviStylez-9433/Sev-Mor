<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

$response = ['success' => false, 'message' => '', 'debug' => []];

// 1. Configuración de la base de datos
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "medpredict";

try {
    // 2. Conectar a MySQL
    $conn = new PDO("mysql:host=$servername;dbname=$dbname", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $response['debug'][] = "Conexión a MySQL exitosa";

    // 3. Obtener datos del POST
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    $response['debug']['received_data'] = $data;

    if ($data === null) {
        throw new Exception("Datos JSON inválidos: " . $json);
    }

    // 4. Validar datos requeridos
    $required = ['nombre', 'apellido', 'edad'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            throw new Exception("El campo $field es requerido");
        }
    }

    // 5. Preparar consulta SQL
    $sql = "INSERT INTO diagnosticos (
        fecha, nombre, apellido, edad, sexo, presion_arterial, 
        frecuencia_cardiaca, saturacion_oxigeno, condiciones_cronicas, 
        observaciones, riesgo_mortalidad, nivel_severidad, factores_riesgo
    ) VALUES (
        NOW(), :nombre, :apellido, :edad, :sexo, :presion_arterial, 
        :frecuencia_cardiaca, :saturacion_oxigeno, :condiciones_cronicas, 
        :observaciones, :riesgo_mortalidad, :nivel_severidad, :factores_riesgo
    )";

    $stmt = $conn->prepare($sql);
    $response['debug']['sql'] = $sql;

    // 6. Ejecutar consulta
    $executed = $stmt->execute([
        ':nombre' => $data['nombre'],
        ':apellido' => $data['apellido'],
        ':edad' => $data['edad'],
        ':sexo' => $data['sexo'] ?? 'no especificado',
        ':presion_arterial' => $data['presion_arterial'] ?? 0,
        ':frecuencia_cardiaca' => $data['frecuencia_cardiaca'] ?? 0,
        ':saturacion_oxigeno' => $data['saturacion_oxigeno'] ?? 0,
        ':condiciones_cronicas' => $data['condiciones_cronicas'] ?? '0',
        ':observaciones' => $data['observaciones'] ?? '',
        ':riesgo_mortalidad' => $data['riesgo_mortalidad'] ?? '',
        ':nivel_severidad' => $data['nivel_severidad'] ?? '',
        ':factores_riesgo' => $data['factores_riesgo'] ?? ''
    ]);

    if ($executed) {
        $response['success'] = true;
        $response['message'] = "Diagnóstico guardado correctamente";
        $response['id'] = $conn->lastInsertId();
    } else {
        $errorInfo = $stmt->errorInfo();
        throw new Exception("Error al ejecutar la consulta: " . json_encode($errorInfo));
    }

} catch(PDOException $e) {
    $response['message'] = "Error de base de datos";
    $response['error'] = $e->getMessage();
    $response['error_info'] = $e->errorInfo ?? null;
} catch(Exception $e) {
    $response['message'] = "Error general";
    $response['error'] = $e->getMessage();
}

// 7. Registrar en un archivo log (para depuración)
file_put_contents('debug_log.txt', date('Y-m-d H:i:s') . " - " . json_encode($response) . "\n", FILE_APPEND);

// 8. Retornar respuesta
echo json_encode($response);
?>